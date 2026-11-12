import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { findDeletion } from "@/lib/account/receipts";
import { prose } from "../prose";

export const metadata: Metadata = { title: "Radera konto – ChoreBacon" };

const dateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "long", timeStyle: "short" });

export default function DeleteAccount({ searchParams }: PageProps<"/radera-konto">) {
  return (
    <article className={prose}>
      <h1>Radera ditt konto</h1>
      {/* Facebook links here with ?kod=… after a deletion request. */}
      <Suspense fallback={null}>
        <DeletionStatus searchParams={searchParams} />
      </Suspense>

      <h2>Så raderar du kontot</h2>
      <ul>
        <li>
          <strong>I appen:</strong> öppna fliken Översikt, tryck på <em>Radera konto</em> och bekräfta. Är du den enda
          föräldern i en familj med fler medlemmar ber appen dig först göra någon annan till förälder.
        </li>
        <li>
          <strong>Via Facebook:</strong> ta bort ChoreBacon under Inställningar och integritet → Inställningar → Appar och
          webbplatser. Ditt ChoreBacon-konto raderas då automatiskt.
        </li>
        <li>
          <strong>Via e-post:</strong> skriv till <a href="mailto:arto@ictor.se">arto@ictor.se</a> från den e-postadress som
          hör till ditt konto. Vi raderar kontot inom 30 dagar och bekräftar per e-post.
        </li>
      </ul>

      <h2>Vad som händer</h2>
      <p>
        Ditt namn, din e-postadress, kopplingen till ditt Google- eller Facebookkonto, dina inloggningar och ditt
        familjemedlemskap tas bort direkt. Poänghistorik och gjorda sysslor finns kvar utan koppling till dig, så att
        familjens historik stämmer. Loggar du in igen senare får du ett nytt, tomt konto. Läs mer i{" "}
        <Link href="/integritet">integritetspolicyn</Link>.
      </p>
    </article>
  );
}

async function DeletionStatus({ searchParams }: Pick<PageProps<"/radera-konto">, "searchParams">) {
  const { kod } = await searchParams;
  if (typeof kod !== "string" || kod.length === 0 || kod.length > 32) return null;
  const receipt = await findDeletion(db, kod);
  return (
    <p className="rounded border border-orange-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      {receipt?.completedAt ? (
        <>
          Begäran <strong>{receipt.code}</strong> är genomförd: kontot raderades {dateFormat.format(receipt.completedAt)}.
        </>
      ) : receipt ? (
        <>Begäran <strong>{receipt.code}</strong> är mottagen och behandlas.</>
      ) : (
        <>Vi hittar ingen begäran med koden {kod}.</>
      )}
    </p>
  );
}
