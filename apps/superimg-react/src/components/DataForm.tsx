//! DataForm - Auto-generated form from template defaults

import { useState, useCallback, createContext, useContext, type CSSProperties } from "react";
import {
  inferSchema,
  humanizeKey,
  type FieldSchema,
  type FieldType,
} from "../utils/inferSchema.js";

export type DataFormTheme = "light" | "dark";

export interface DataFormProps {
  /** Template defaults to infer schema from */
  defaults: Record<string, unknown>;
  /** Current data values (merged with defaults) */
  data: Record<string, unknown>;
  /** Called when any field value changes */
  onChange: (data: Record<string, unknown>) => void;
  /** Optional CSS class for container */
  className?: string;
  /** Optional inline styles for container */
  style?: CSSProperties;
  /** Color theme ("light" or "dark", defaults to "dark") */
  theme?: DataFormTheme;
}

const ThemeContext = createContext<DataFormTheme>("dark");

// Theme-aware styles
function getStyles(theme: DataFormTheme) {
  const isDark = theme === "dark";
  return {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 12,
    },
    fieldGroup: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 4,
    },
    label: {
      fontSize: 12,
      fontWeight: 500,
      color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)",
      marginBottom: 2,
    },
    input: {
      width: "100%",
      padding: "6px 8px",
      fontSize: 13,
      background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.15)",
      borderRadius: 4,
      color: isDark ? "#fff" : "#000",
      outline: "none",
    },
    inputFocus: {
      borderColor: "rgba(102, 126, 234, 0.6)",
    },
    colorWrapper: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 4,
      border: isDark ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid rgba(0, 0, 0, 0.2)",
      cursor: "pointer",
      flexShrink: 0,
    },
    colorInput: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      opacity: 0,
      width: 28,
      height: 28,
      cursor: "pointer",
    },
    numberWrapper: {
      display: "flex",
      alignItems: "center",
      gap: 4,
    },
    numberButton: {
      width: 24,
      height: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.15)",
      borderRadius: 4,
      color: isDark ? "#fff" : "#000",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
    },
    toggle: {
      position: "relative" as const,
      width: 36,
      height: 20,
      borderRadius: 10,
      cursor: "pointer",
      transition: "background 0.2s",
    },
    toggleKnob: {
      position: "absolute" as const,
      top: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      background: "#fff",
      transition: "left 0.2s",
      boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.2)",
    },
    nestedContainer: {
      marginLeft: 12,
      paddingLeft: 12,
      borderLeft: isDark ? "2px solid rgba(255, 255, 255, 0.1)" : "2px solid rgba(0, 0, 0, 0.1)",
    },
    emptyMessage: {
      color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
      fontSize: 13,
      fontStyle: "italic" as const,
    },
    jsonPreview: {
      fontSize: 11,
      fontFamily: "monospace",
      background: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.05)",
      padding: 8,
      borderRadius: 4,
      color: isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)",
      overflow: "auto",
      maxHeight: 100,
    },
    toggleOff: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
  };
}

function useThemeStyles() {
  const theme = useContext(ThemeContext);
  return getStyles(theme);
}

interface FieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  prefix?: string;
}

function TextField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(fullKey, e.target.value)}
        style={styles.input}
        placeholder={schema.label}
      />
    </div>
  );
}

function UrlField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <input
        type="url"
        value={String(value ?? "")}
        onChange={(e) => onChange(fullKey, e.target.value)}
        style={styles.input}
        placeholder="https://..."
      />
    </div>
  );
}

function NumberField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  const numValue = typeof value === "number" ? value : 0;

  const increment = () => onChange(fullKey, numValue + 1);
  const decrement = () => onChange(fullKey, numValue - 1);

  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <div style={styles.numberWrapper}>
        <button
          type="button"
          onClick={decrement}
          style={styles.numberButton}
        >
          -
        </button>
        <input
          type="number"
          value={numValue}
          onChange={(e) => onChange(fullKey, parseFloat(e.target.value) || 0)}
          style={{ ...styles.input, flex: 1, textAlign: "center" as const }}
        />
        <button
          type="button"
          onClick={increment}
          style={styles.numberButton}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ColorField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  const colorValue = String(value ?? "#000000");

  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <div style={styles.colorWrapper}>
        <div style={{ position: "relative" as const }}>
          <div
            style={{
              ...styles.colorSwatch,
              background: colorValue,
            }}
          />
          <input
            type="color"
            value={colorValue.length === 4 ? expandShortHex(colorValue) : colorValue}
            onChange={(e) => onChange(fullKey, e.target.value)}
            style={styles.colorInput}
          />
        </div>
        <input
          type="text"
          value={colorValue}
          onChange={(e) => onChange(fullKey, e.target.value)}
          style={{ ...styles.input, flex: 1, fontFamily: "monospace" }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function BooleanField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  const boolValue = Boolean(value);

  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <div
        onClick={() => onChange(fullKey, !boolValue)}
        style={{
          ...styles.toggle,
          background: boolValue ? "rgba(102, 126, 234, 0.8)" : styles.toggleOff,
        }}
      >
        <div
          style={{
            ...styles.toggleKnob,
            left: boolValue ? 18 : 2,
          }}
        />
      </div>
    </div>
  );
}

function ObjectField({ schema, value, onChange, prefix }: FieldProps) {
  const styles = useThemeStyles();
  const fullKey = prefix ? `${prefix}.${schema.key}` : schema.key;
  const objValue = (value && typeof value === "object" && !Array.isArray(value))
    ? value as Record<string, unknown>
    : {};

  if (!schema.children || schema.children.length === 0) {
    // Show JSON preview for deep objects
    return (
      <div style={styles.fieldGroup}>
        <label style={styles.label}>{schema.label}</label>
        <pre style={styles.jsonPreview}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <div style={styles.nestedContainer}>
        {schema.children.map((child) => (
          <FieldRenderer
            key={child.key}
            schema={child}
            value={objValue[child.key]}
            onChange={onChange}
            prefix={fullKey}
          />
        ))}
      </div>
    </div>
  );
}

function ArrayField({ schema, value, prefix }: FieldProps) {
  const styles = useThemeStyles();
  // v1: Just show JSON preview for arrays
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{schema.label}</label>
      <pre style={styles.jsonPreview}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function FieldRenderer({ schema, value, onChange, prefix }: FieldProps) {
  const props = { schema, value, onChange, prefix };

  switch (schema.type) {
    case "color":
      return <ColorField {...props} />;
    case "url":
      return <UrlField {...props} />;
    case "number":
      return <NumberField {...props} />;
    case "boolean":
      return <BooleanField {...props} />;
    case "object":
      return <ObjectField {...props} />;
    case "array":
      return <ArrayField {...props} />;
    case "text":
    default:
      return <TextField {...props} />;
  }
}

// Expand short hex (#abc) to full hex (#aabbcc)
function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/**
 * Auto-generated form based on template defaults
 *
 * @example
 * ```tsx
 * <DataForm
 *   defaults={template.defaults}
 *   data={currentData}
 *   onChange={(newData) => session.setData(newData)}
 * />
 * ```
 */
export function DataForm({
  defaults,
  data,
  onChange,
  className,
  style,
  theme = "dark",
}: DataFormProps) {
  const schema = inferSchema(defaults);
  const styles = getStyles(theme);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      // Handle nested keys (e.g., "nested.key")
      if (key.includes(".")) {
        const keys = key.split(".");
        const newData = { ...data };
        let current = newData;

        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          current[k] = { ...(current[k] as Record<string, unknown> || {}) };
          current = current[k] as Record<string, unknown>;
        }

        current[keys[keys.length - 1]] = value;
        onChange(newData);
      } else {
        onChange({ ...data, [key]: value });
      }
    },
    [data, onChange]
  );

  if (schema.length === 0) {
    return (
      <ThemeContext.Provider value={theme}>
        <div className={className} style={{ ...styles.container, ...style }}>
          <p style={styles.emptyMessage}>No configurable data</p>
        </div>
      </ThemeContext.Provider>
    );
  }

  // Merge defaults with data for display
  const mergedData = { ...defaults, ...data };

  return (
    <ThemeContext.Provider value={theme}>
      <div className={className} style={{ ...styles.container, ...style }}>
        {schema.map((field) => (
          <FieldRenderer
            key={field.key}
            schema={field}
            value={mergedData[field.key]}
            onChange={handleFieldChange}
          />
        ))}
      </div>
    </ThemeContext.Provider>
  );
}
