import { Musiker } from '../../services/firebase/musikerService';

export interface Gig {
  id?: string;
  title?: string;
  dateStr: string;
  gage: number;
}

interface HonorarnoteTemplateViewProps {
  musiker: Musiker;
  gigs: Gig[];
  month: number;
  year: number;
}

export function HonorarnoteTemplateView({ musiker, gigs, month, year }: HonorarnoteTemplateViewProps) {
  const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const mwstRate = musiker.steuersatz !== undefined ? musiker.steuersatz : 13;
  
  let sumNetto = 0;
  let sumBrutto = 0;

  const rows = gigs.map((gig, idx) => {
    const mwstAmount = gig.gage * (mwstRate / 100);
    const brutto = gig.gage + mwstAmount;
    
    sumNetto += gig.gage;
    sumBrutto += brutto;

    return (
      <tr key={idx}>
        <td className="p-1 border border-gray-300 text-sm whitespace-nowrap">{gig.dateStr}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{formatter.format(gig.gage)}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{mwstRate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">{formatter.format(brutto)}</td>
        <td className="p-1 text-right border border-gray-300 text-sm whitespace-nowrap">&euro;</td>
      </tr>
    );
  });

  const today = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const periodStr = `${String(month).padStart(2, '0')}/${year}`;

  return (
    <div 
      className="bg-white text-black p-8 font-sans w-[720px]"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      <div className="mb-16 text-[14px]">
        <p className="font-medium">{musiker.vorname} {musiker.nachname}</p>
        <p>{musiker.strasse}</p>
        <p>{musiker.plz} {musiker.ort}</p>
        {(musiker as any).steuernummer && <p className="mt-1">Steuernummer: {(musiker as any).steuernummer}</p>}
      </div>

      <div className="flex justify-between items-start mb-16 text-[14px]">
        <div>
          <p className="font-bold">An</p>
          <p className="font-bold">Konzerte im Mozarthaus</p>
          <p className="font-bold">Claudio Cunha Bentes</p>
          <p className="font-bold">Konzertveranstalter</p>
          <p className="font-bold">Singerstrasse 7</p>
          <p className="font-bold">A - 1010 Wien</p>
        </div>
        <div className="text-right text-[14px]">
          <p>Wien am, {today}</p>
        </div>
      </div>

      <h1 className="text-[22px] font-bold text-center mb-8 tracking-wide">HONORARNOTE für {periodStr}</h1>

      <p className="mb-8 leading-relaxed text-[14px]">
        Für meine Auftritte in der Sala Terrena im Deutsch Ordenshaus, Singerstraße 7, 1010 Wien, erlaube ich mir folgenden Betrag in Rechnung zu stellen:
      </p>

      <table className="w-full border-collapse mb-10 mx-auto max-w-3xl">
        <thead>
          <tr className="bg-[#8b0000] text-white">
            <th className="p-1.5 text-left border border-[#8b0000] text-sm font-bold">Konzert am</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Nettobetrag</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">MwSt</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Bruttobetrag</th>
            <th className="p-1.5 text-right border border-[#8b0000] text-sm font-bold">Spesen</th>
          </tr>
        </thead>
        <tbody>
          {rows}
          <tr className="bg-[#8b0000] text-white font-bold">
            <td className="p-1.5 text-left border border-[#8b0000] text-sm">Summe:</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{formatter.format(sumNetto)}</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{mwstRate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">{formatter.format(sumBrutto)}</td>
            <td className="p-1.5 text-right border border-[#8b0000] text-sm">&euro;</td>
          </tr>
        </tbody>
      </table>

      <div className="space-y-6 text-[14px]">
        <p>Der Betrag von <span className="font-bold">{formatter.format(sumBrutto)}</span> + ________ &euro; Spesenersatz wird auf Ihr Konto überwiesen.</p>
        <p>Ich nehme zur Kenntnis, daß ich für die Versteuerung der Honorare selbst sorgen muß, da kein Dienstverhältnis vorliegt.</p>
        
        <div className="mt-24 pt-8 text-center flex justify-center">
            <div className="w-96 text-left">
                <p>Unterschrift: ___________________________________</p>
            </div>
        </div>
      </div>
    </div>
  );
}
