export interface ReceiptInput {
  id: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'application/pdf';
  size: number;
  content: string;
}
export interface Receipt extends ReceiptInput {
  transactionId: string;
  createdAt: number;
}
export type ReceiptMetadata = Omit<Receipt, 'content'>;
