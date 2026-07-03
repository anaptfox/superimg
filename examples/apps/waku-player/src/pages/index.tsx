import { PlayerGallery } from "../components/PlayerGallery";

export default async function HomePage() {
  return (
    <>
      <title>SuperImg × Waku</title>
      <PlayerGallery />
    </>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
