//! Headless Blitz HTML → RGBA/PNG, compiled to wasm32-unknown-unknown.
//! Depends on published crates.io Blitz 0.3.0-beta.1 (no NAPI, no native modules).

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use anyrender::{ImageRenderer, PaintScene};
use anyrender_vello_cpu::VelloCpuImageRenderer;
use base64::Engine as _;
use blitz_dom::{
    DocumentConfig, StyleThreading, decode_font_bytes,
    util::Color,
};
use blitz_html::{HtmlDocument, HtmlProvider};
use blitz_paint::paint_scene;
use blitz_traits::net::{Bytes, NetHandler, NetProvider, Request};
use blitz_traits::shell::{ColorScheme, Viewport};
use parley::FontContext;
use parley::fontique::{
    Blob, Collection, CollectionOptions, FontInfoOverride, GenericFamily, SourceCache,
};
use peniko::Fill;
use peniko::kurbo::Rect;
use png::{Compression, Encoder};
use wasm_bindgen::prelude::*;

/// DejaVu Sans (Bitstream Vera / DejaVu, permissive). Browsers do not expose
/// system fonts to wasm; this is the standard Blitz wasm setup.
const DEJAVU_SANS: &[u8] = include_bytes!("../assets/DejaVuSans.woff2");

struct FontFace {
    family: String,
    data: Vec<u8>,
}

struct DataUrlNet {
    served: AtomicBool,
}

impl DataUrlNet {
    fn take_served(&self) -> bool {
        self.served.swap(false, Ordering::SeqCst)
    }
}

impl NetProvider for DataUrlNet {
    fn fetch(&self, _doc_id: usize, request: Request, handler: Box<dyn NetHandler>) {
        let url = request.url.as_str();
        if let Some(bytes) = decode_data_url(url) {
            self.served.store(true, Ordering::SeqCst);
            handler.bytes(url.to_string(), Bytes::from(bytes));
        }
    }
}

#[wasm_bindgen]
pub struct BlitzEngine {
    width: u32,
    height: u32,
    scale: f32,
    faces: Vec<FontFace>,
    document: Option<HtmlDocument>,
    frame_id: Option<usize>,
    renderer: VelloCpuImageRenderer,
    net: Arc<DataUrlNet>,
}

#[wasm_bindgen]
impl BlitzEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> Result<BlitzEngine, JsValue> {
        console_error_panic_hook::set_once();
        if width == 0 || height == 0 {
            return Err(JsValue::from_str("width and height must be > 0"));
        }
        if width > u16::MAX as u32 || height > u16::MAX as u32 {
            return Err(JsValue::from_str(
                "vello_cpu image renderer is u16-sized; max dimension is 65535",
            ));
        }
        Ok(BlitzEngine {
            width,
            height,
            scale: 1.0,
            faces: Vec::new(),
            document: None,
            frame_id: None,
            renderer: VelloCpuImageRenderer::new(width, height),
            net: Arc::new(DataUrlNet {
                served: AtomicBool::new(false),
            }),
        })
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Device pixel ratio. Call before the first rasterize. Video stays 1.
    #[wasm_bindgen(js_name = setHidpi)]
    pub fn set_hidpi(&mut self, scale: f32) -> Result<(), JsValue> {
        if self.document.is_some() {
            return Err(JsValue::from_str("setHidpi must run before the first rasterize"));
        }
        if scale <= 0.0 {
            return Err(JsValue::from_str("hidpi scale must be > 0"));
        }
        let pw = (self.width as f32 * scale).round() as u32;
        let ph = (self.height as f32 * scale).round() as u32;
        if pw > u16::MAX as u32 || ph > u16::MAX as u32 {
            return Err(JsValue::from_str(
                "vello_cpu image renderer is u16-sized; max dimension is 65535",
            ));
        }
        self.scale = scale;
        self.renderer = VelloCpuImageRenderer::new(pw, ph);
        Ok(())
    }

    /// Register a font face before the first rasterize. Family names must match CSS.
    #[wasm_bindgen(js_name = addFont)]
    pub fn add_font(&mut self, family: &str, _weight: u16, _italic: bool, data: &[u8]) -> Result<(), JsValue> {
        if self.document.is_some() {
            return Err(JsValue::from_str("addFont must run before the first rasterize"));
        }
        self.faces.push(FontFace {
            family: family.to_string(),
            data: data.to_vec(),
        });
        Ok(())
    }

    /// Rasterize `html` at animation time `t` seconds. Returns raw RGBA8.
    #[wasm_bindgen(js_name = rasterizeRgba)]
    pub fn rasterize_rgba(&mut self, html: &str, t: f64) -> Result<Vec<u8>, JsValue> {
        self.paint(html, t).map_err(|e| JsValue::from_str(&e))
    }

    /// Rasterize `html` at animation time `t` seconds. Returns PNG bytes.
    #[wasm_bindgen(js_name = rasterizePng)]
    pub fn rasterize_png(&mut self, html: &str, t: f64) -> Result<Vec<u8>, JsValue> {
        let rgba = self.paint(html, t).map_err(|e| JsValue::from_str(&e))?;
        let (pw, ph) = self.physical();
        encode_png(&rgba, pw, ph).map_err(|e| JsValue::from_str(&e))
    }
}

impl BlitzEngine {
    fn physical(&self) -> (u32, u32) {
        (
            (self.width as f32 * self.scale).round() as u32,
            (self.height as f32 * self.scale).round() as u32,
        )
    }

    fn paint(&mut self, html: &str, t: f64) -> Result<Vec<u8>, String> {
        if self.document.is_none() {
            self.boot(html)?;
        } else {
            self.update_html(html)?;
        }

        {
            let document = self.document.as_mut().ok_or("document missing")?;
            document.resolve(t);
        }
        if self.net.take_served() {
            self.document.as_mut().ok_or("document missing")?.resolve(t);
        }

        let pw = (self.width as f32 * self.scale).round() as u32;
        let ph = (self.height as f32 * self.scale).round() as u32;
        let scale = self.scale as f64;
        let document = self.document.as_mut().ok_or("document missing")?;
        self.renderer.reset();
        let mut buffer = Vec::new();
        self.renderer.render_to_vec(
            |scene| {
                scene.fill(
                    Fill::NonZero,
                    Default::default(),
                    Color::new([1.0, 1.0, 1.0, 1.0]),
                    Default::default(),
                    &Rect::new(0.0, 0.0, pw as f64, ph as f64),
                );
                paint_scene(scene, document, scale, pw, ph, 0, 0);
            },
            &mut buffer,
        );
        Ok(buffer)
    }

    fn boot(&mut self, html: &str) -> Result<(), String> {
        let (pw, ph) = self.physical();
        let wrapped = if is_full_document(html) {
            html.to_string()
        } else {
            wrap_fragment(html, self.width, self.height)
        };
        let font_ctx = build_font_ctx(&self.faces);
        let mut document = HtmlDocument::from_html(
            &wrapped,
            DocumentConfig {
                viewport: Some(Viewport::new(pw, ph, self.scale, ColorScheme::Light)),
                font_ctx: Some(font_ctx),
                style_threading: StyleThreading::Sequential,
                html_parser_provider: Some(Arc::new(HtmlProvider) as _),
                net_provider: Some(self.net.clone() as _),
                ..Default::default()
            },
        );
        document.set_html_parser_provider(Arc::new(HtmlProvider));
        document.set_incremental_layout(true);
        self.frame_id = document
            .get_element_by_id("frame")
            .or_else(|| document.query_selector("body").ok().flatten());
        self.document = Some(document);
        Ok(())
    }

    fn update_html(&mut self, html: &str) -> Result<(), String> {
        let inner = extract_updatable_html(html);
        let frame_id = self.frame_id.ok_or("no #frame or body to update")?;
        let document = self.document.as_mut().ok_or("document missing")?;
        {
            let mut mutr = document.mutate();
            mutr.set_inner_html(frame_id, inner);
        }
        Ok(())
    }
}

fn is_full_document(html: &str) -> bool {
    let t = html.trim_start();
    t.get(..9).is_some_and(|s| s.eq_ignore_ascii_case("<!doctype"))
        || t.get(..5).is_some_and(|s| s.eq_ignore_ascii_case("<html"))
}

fn wrap_fragment(html: &str, width: u32, height: u32) -> String {
    format!(
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><style>html,body{{margin:0;width:{width}px;height:{height}px;overflow:hidden}}#frame{{position:relative;width:100%;height:100%}}</style></head><body><div id=\"frame\">{html}</div></body></html>"
    )
}

fn extract_updatable_html(html: &str) -> &str {
    if !is_full_document(html) {
        return html;
    }
    if let Some(start) = html.find("id=\"frame\"") {
        if let Some(rel) = html[start..].find('>') {
            let inner_start = start + rel + 1;
            if let Some(end) = html.rfind("</div></body>") {
                if end >= inner_start {
                    return &html[inner_start..end];
                }
            }
        }
    }
    if let Some(body) = find_tag_open(html, "body") {
        if let Some(end) = html.rfind("</body>") {
            if end >= body {
                return &html[body..end];
            }
        }
    }
    html
}

fn find_tag_open(html: &str, tag: &str) -> Option<usize> {
    let needle = format!("<{tag}");
    let start = html.find(&needle)?;
    let gt = html[start..].find('>')?;
    Some(start + gt + 1)
}

fn is_mono_family(family: &str) -> bool {
    let f = family.to_ascii_lowercase();
    f.contains("mono") || f.contains("code") || f.contains("console")
}

fn build_font_ctx(faces: &[FontFace]) -> FontContext {
    let mut ctx = FontContext {
        source_cache: SourceCache::new_shared(),
        collection: Collection::new(CollectionOptions {
            shared: false,
            system_fonts: false,
        }),
    };

    let mut sans_ids: Vec<parley::fontique::FamilyId> = Vec::new();
    let mut mono_ids: Vec<parley::fontique::FamilyId> = Vec::new();
    for face in faces {
        let ids = register_face(&mut ctx, face);
        if is_mono_family(&face.family) {
            mono_ids.extend(ids);
        } else {
            sans_ids.extend(ids);
        }
    }
    if !sans_ids.is_empty() {
        for generic in [GenericFamily::SansSerif, GenericFamily::SystemUi, GenericFamily::Serif] {
            ctx.collection
                .append_generic_families(generic, sans_ids.iter().copied());
        }
    }
    if !mono_ids.is_empty() {
        ctx.collection
            .append_generic_families(GenericFamily::Monospace, mono_ids.iter().copied());
    }

    let deja = register_bytes(&mut ctx, DEJAVU_SANS, None);
    for generic in [
        GenericFamily::SansSerif,
        GenericFamily::Serif,
        GenericFamily::Monospace,
        GenericFamily::SystemUi,
    ] {
        ctx.collection
            .append_generic_families(generic, deja.iter().copied());
    }
    ctx
}

fn register_face(ctx: &mut FontContext, face: &FontFace) -> Vec<parley::fontique::FamilyId> {
    let override_info = if face.family.is_empty() {
        None
    } else {
        Some(FontInfoOverride {
            family_name: Some(face.family.as_str()),
            ..Default::default()
        })
    };
    register_bytes(ctx, &face.data, override_info)
}

fn register_bytes(
    ctx: &mut FontContext,
    font_data: &[u8],
    override_info: Option<FontInfoOverride<'_>>,
) -> Vec<parley::fontique::FamilyId> {
    let decoded = decode_font_bytes(font_data).into_owned();
    ctx.collection
        .register_fonts(Blob::new(Arc::new(decoded) as _), override_info)
        .into_iter()
        .map(|(id, _)| id)
        .collect()
}

fn decode_data_url(url: &str) -> Option<Vec<u8>> {
    let rest = url.strip_prefix("data:")?;
    let (meta, payload) = rest.split_once(',')?;
    if meta.contains(";base64") {
        base64::engine::general_purpose::STANDARD
            .decode(payload.as_bytes())
            .ok()
    } else {
        Some(percent_encoding::percent_decode_str(payload).collect())
    }
}

fn encode_png(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut encoder = Encoder::new(&mut out, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.set_compression(Compression::Fast);
    let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
    writer.write_image_data(rgba).map_err(|e| e.to_string())?;
    writer.finish().map_err(|e| e.to_string())?;
    Ok(out)
}
