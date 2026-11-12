export class RequestNotFoundError extends Error {
  constructor() {
    super("This request does not exist.");
    this.name = "RequestNotFoundError";
  }
}

export class UnsupportedAssetError extends Error {
  constructor() {
    super("Choose USDC or XLM.");
    this.name = "UnsupportedAssetError";
  }
}

export class InvalidNoteError extends Error {
  constructor() {
    super("Keep the note to 280 characters.");
    this.name = "InvalidNoteError";
  }
}

export class InvalidEndDateError extends Error {
  constructor() {
    super("Choose an end date in the future.");
    this.name = "InvalidEndDateError";
  }
}

export class InvalidMinimumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMinimumError";
  }
}

export class RequestAlreadyPaidError extends Error {
  constructor() {
    super("This request has been paid.");
    this.name = "RequestAlreadyPaidError";
  }
}

export class RequestClosedError extends Error {
  constructor() {
    super("The receiver closed this request.");
    this.name = "RequestClosedError";
  }
}

export class RequestEndedError extends Error {
  constructor() {
    super("This request has ended.");
    this.name = "RequestEndedError";
  }
}
