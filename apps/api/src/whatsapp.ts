export interface MessagePayload {
  toPhone: string;
  customerName: string;
  template: string;
  variables?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  status: "sent" | "stubbed" | "failed";
  error?: string;
}

export interface MessageSender {
  sendMessage(payload: MessagePayload): Promise<SendResult>;
}

/** Stub logger implementation. Does not call external paid APIs or Meta Cloud API. */
export class StubMessageSender implements MessageSender {
  async sendMessage(payload: MessagePayload): Promise<SendResult> {
    const messageId = `msg-stub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[WHATSAPP_STUB_LOG] Sent to: ${payload.toPhone} | Name: ${payload.customerName} | Template: ${payload.template}`);
    return {
      success: true,
      messageId,
      status: "stubbed",
    };
  }
}

export const messageSender: MessageSender = new StubMessageSender();

