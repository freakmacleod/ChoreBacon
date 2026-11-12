import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-orange-600">ChoreBacon</h1>
      <p className="text-lg">Gör sysslor, tjäna poäng och lös in belöningar – för hela familjen.</p>
      <ul className="list-disc space-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
        <li>Bocka av dagliga, veckovisa och månatliga sysslor.</li>
        <li>Samla poäng och lås upp prestationer.</li>
        <li>Föräldrar godkänner sysslor och bestämmer familjens belöningar.</li>
      </ul>
      <p className="text-sm text-zinc-500">
        Läs hur vi hanterar personuppgifter i vår <Link href="/integritet" className="underline">integritetspolicy</Link>, och hur du{" "}
        <Link href="/radera-konto" className="underline">raderar ditt konto</Link>.
      </p>
    </div>
  );
}
