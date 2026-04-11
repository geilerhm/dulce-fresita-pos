import { DEFAULT_BLESSINGS } from "./blessing-phrases";

const RECEIPT_CONFIG_KEY = "dulce-fresita-receipt-config";

export interface ReceiptConfig {
  address: string;
  phone: string;
  nit: string;
  footerMessage: string;
  showLogo: boolean;
  showBlessing: boolean;
  blessingPhrases: string[];
}

const DEFAULT_CONFIG: ReceiptConfig = {
  address: "",
  phone: "",
  nit: "",
  footerMessage: "¡Gracias por tu compra!\nTe esperamos pronto",
  showLogo: true,
  showBlessing: true,
  blessingPhrases: DEFAULT_BLESSINGS,
};

export function getReceiptConfig(): ReceiptConfig {
  try {
    const data = localStorage.getItem(RECEIPT_CONFIG_KEY);
    return data ? { ...DEFAULT_CONFIG, ...JSON.parse(data) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveReceiptConfig(config: ReceiptConfig) {
  localStorage.setItem(RECEIPT_CONFIG_KEY, JSON.stringify(config));
}
