import type {
  AvailableTollFreeNumber,
  TwilioReadService,
} from "@/services/twilio";

export class AvailableNumberEngine {
  constructor(private readonly twilio: TwilioReadService) {}

  async search(input: {
    countryCode?: string;
    areaCode?: string;
    contains?: string;
    limit?: number;
  }): Promise<readonly AvailableTollFreeNumber[]> {
    const countryCode = input.countryCode ?? "US";
    if (countryCode !== "US") {
      throw new Error("Only US toll-free number searches are supported.");
    }
    if (input.areaCode && !/^\d{3}$/.test(input.areaCode)) {
      throw new Error("areaCode must contain exactly three digits.");
    }
    if (
      input.contains &&
      !/^[0-9*]{1,20}$/.test(input.contains.replace(/^\+/, ""))
    ) {
      throw new Error("contains has an invalid format.");
    }
    return this.twilio.searchAvailableTollFreeNumbers({
      countryCode: "US",
      areaCode: input.areaCode,
      contains: input.contains,
      limit: Math.min(Math.max(input.limit ?? 20, 1), 100),
    });
  }
}
