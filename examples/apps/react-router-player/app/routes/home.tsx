import { PlayerGallery } from "../components/PlayerGallery";

export function meta() {
  return [
    { title: "SuperImg × React Router" },
    {
      name: "description",
      content: "Live SuperImg <Player> previews in a React Router framework-mode app.",
    },
  ];
}

export default function Home() {
  return <PlayerGallery />;
}
