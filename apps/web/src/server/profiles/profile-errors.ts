export class HandleTakenError extends Error {
  constructor() {
    super("That handle is taken. Try another.");
    this.name = "HandleTakenError";
  }
}

// A handle is part of every link already shared, so it is chosen once.
export class HandleAlreadyClaimedError extends Error {
  constructor() {
    super("You already have a handle, and it cannot be changed.");
    this.name = "HandleAlreadyClaimedError";
  }
}

export class InvalidDisplayNameError extends Error {
  constructor() {
    super("Use a name of 1 to 50 characters.");
    this.name = "InvalidDisplayNameError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super("There is no Pomi page here.");
    this.name = "ProfileNotFoundError";
  }
}
