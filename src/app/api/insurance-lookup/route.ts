import { NextResponse } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

const SASIS_CONFIGURED = !!EnvConfig.sasisApiBase;

type SasisInsurance = {
  ean_party?: string;
  BAG_insurance_id?: string;
  name?: string;
  description?: string;
};

type SasisBasicData = {
  card_id?: string;
  assured_id?: string;
  unique_id?: string;
  familyname?: string;
  givenname?: string;
  birthdate?: string;
  gender?: string;
  address?: { street?: string; zip?: string; city?: string };
};

type SasisResponse = {
  returnCode?: string;
  returnMessage?: string;
  patient?: {
    validFrom?: string;
    validUntil?: string;
    language?: string;
    insurance?: SasisInsurance;
    basicData?: SasisBasicData;
  };
};

// Format AHV number: 7560012038550 → 756.0012.0385.50
function formatAhv(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7, 11)}.${digits.slice(11)}`;
}

export async function GET(request: Request) {
  if (!SASIS_CONFIGURED) {
    return NextResponse.json(
      { error: "Keine SASIS-Verbindung konfiguriert." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const cardNumber = (searchParams.get("cardNumber") || "").trim();
  const date = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();

  if (!cardNumber) {
    return NextResponse.json({ error: "cardNumber fehlt" }, { status: 400 });
  }
  if (!/^\d{20}$/.test(cardNumber) || !cardNumber.startsWith("80")) {
    return NextResponse.json(
      { error: "Ungültige Versicherungskartennummer (20 Stellen, beginnt mit 80)" },
      { status: 400 }
    );
  }

  try {
    const url = `${EnvConfig.sasisApiBase}/${encodeURIComponent(cardNumber)}/${encodeURIComponent(date)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `SASIS API Fehler: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as SasisResponse;

    if (data.returnCode !== "0") {
      return NextResponse.json(
        { error: data.returnMessage || "SASIS Fehler" },
        { status: 400 }
      );
    }

    const ins = data.patient?.insurance;
    const basic = data.patient?.basicData;

    return NextResponse.json({
      insurerName: ins?.name || "",
      ik: ins?.ean_party || "",
      bagId: ins?.BAG_insurance_id || "",
      veka: basic?.card_id || cardNumber,
      ahv: formatAhv(basic?.unique_id),
      familyname: basic?.familyname || "",
      givenname: basic?.givenname || "",
      birthdate: basic?.birthdate?.slice(0, 10) || "",
      gender: basic?.gender || "",
      address: basic?.address || null,
      validFrom: data.patient?.validFrom || "",
      validUntil: data.patient?.validUntil || "",
      language: data.patient?.language || "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Netzwerkfehler" }, { status: 500 });
  }
}
