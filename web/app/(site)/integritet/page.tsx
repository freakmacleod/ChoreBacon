import type { Metadata } from "next";
import Link from "next/link";
import { prose } from "../prose";

export const metadata: Metadata = { title: "Integritetspolicy – ChoreBacon" };

export default function PrivacyPolicy() {
  return (
    <article className={prose}>
      <h1>Integritetspolicy</h1>
      <p className="text-sm text-zinc-500">Senast uppdaterad 13 november 2026</p>
      <p>
        Den här policyn beskriver hur ChoreBacon (appen och webbtjänsten på chorebacon.vercel.app) behandlar personuppgifter.
      </p>

      <h2>Personuppgiftsansvarig</h2>
      <p>
        Arto Österlind är personuppgiftsansvarig. Kontakt: <a href="mailto:arto@ictor.se">arto@ictor.se</a>.
      </p>

      <h2>Vilka uppgifter vi behandlar</h2>
      <ul>
        <li>
          <strong>Från inloggningen med Google eller Facebook:</strong> ditt namn, din e-postadress (om du delar den) och ett
          konto-id från tjänsten. Vi får aldrig ditt lösenord.
        </li>
        <li>
          <strong>Det du gör i appen:</strong> vilka sysslor du gjort och när, dina poäng, belöningar du löst in och
          prestationer du låst upp.
        </li>
        <li>
          <strong>Familj:</strong> familjens namn, vilka som är med och om de är förälder eller barn. Familjemedlemmar ser
          varandras namn och poängsaldo. Föräldrar ser barnens gjorda sysslor och inlösta belöningar för att kunna godkänna
          och lämna ut dem.
        </li>
        <li>
          <strong>Tekniska uppgifter:</strong> inloggningssessioner (sparade som hashvärden) och serverloggar hos vår
          driftleverantör, till exempel IP-adress och tidpunkt, för drift och säkerhet. Om du tillåter aviseringar sparar vi
          också telefonens aviseringsadress (en token från Google Firebase), så att vi kan skicka påminnelser och berätta om
          nya sysslor och bonusar.
        </li>
      </ul>

      <h2>Varför vi behandlar uppgifterna</h2>
      <ul>
        <li>
          För att tillhandahålla tjänsten du använder: inloggning, poäng, belöningar, prestationer och familjefunktioner
          (rättslig grund: avtal, artikel 6.1 b i dataskyddsförordningen).
        </li>
        <li>För att hålla tjänsten säker och felsöka (rättslig grund: berättigat intresse, artikel 6.1 f).</li>
      </ul>
      <p>Vi visar ingen reklam, säljer inga uppgifter och använder ingen spårning eller analys från tredje part.</p>

      <h2>Barn</h2>
      <p>
        ChoreBacon är gjord för familjer. Barn under 13 år får bara använda ChoreBacon med vårdnadshavares samtycke, och
        vårdnadshavaren ansvarar för barnets inloggningskonto. En vårdnadshavare kan när som helst be oss radera barnets konto.
      </p>

      <h2>Vilka som hjälper oss (personuppgiftsbiträden)</h2>
      <ul>
        <li>Vercel Inc. – drift av webbtjänsten och API:t, med servrar i Frankfurt (EU).</li>
        <li>Neon – databasen, som lagras hos Amazon Web Services i Frankfurt (EU).</li>
        <li>Google och Meta (Facebook) – för inloggning, enligt deras egna villkor.</li>
        <li>
          Google (Firebase Cloud Messaging) – levererar aviseringar till din telefon, om du tillåter dem. En avisering
          innehåller till exempel namnet på en syssla eller en kombo.
        </li>
      </ul>
      <p>
        Uppgifterna lagras inom EU. Vercel, Neon och Google är amerikanska företag; om uppgifter i undantagsfall behandlas utanför EU
        sker det med skydd enligt EU:s standardavtalsklausuler eller EU–US Data Privacy Framework.
      </p>

      <h2>Hur länge vi sparar uppgifterna</h2>
      <p>
        Så länge du har ett konto. När du raderar kontot tar vi direkt bort ditt namn, din e-postadress, kopplingen till ditt
        Google- eller Facebookkonto, dina inloggningar, telefonens aviseringsadress och ditt familjemedlemskap. Poänghistorik och gjorda sysslor finns kvar
        utan koppling till dig, så att familjens historik stämmer. Serverloggar sparas en kort tid hos driftleverantören.
      </p>

      <h2>Cookies</h2>
      <p>
        Webbtjänsten använder bara nödvändiga cookies för inloggning (inloggningsflödet och administratörssidan). Appen sparar
        din inloggning i telefonens säkra lagring.
      </p>

      <h2>Dina rättigheter</h2>
      <p>
        Du har rätt att få veta vilka uppgifter vi har om dig, få dem rättade eller raderade, begränsa behandlingen, invända
        mot den och få ut dina uppgifter (dataportabilitet). Kontakta <a href="mailto:arto@ictor.se">arto@ictor.se</a>. Du
        kan radera ditt konto själv – se <Link href="/radera-konto">Radera konto</Link>.
      </p>
      <p>
        Om du är missnöjd med hur vi behandlar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten (IMY),{" "}
        <a href="https://www.imy.se">imy.se</a>.
      </p>

      <h2>Ändringar</h2>
      <p>Vi uppdaterar policyn när tjänsten ändras. Datumet högst upp visar senaste ändringen.</p>
    </article>
  );
}
