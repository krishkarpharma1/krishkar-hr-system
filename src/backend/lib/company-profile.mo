import CPTypes "../types/company-profile";
import CommonTypes "../types/common";
import Time "mo:core/Time";

module {
  public type CompanyProfile = CPTypes.CompanyProfile;
  public type UpdateCompanyProfileInput = CPTypes.UpdateCompanyProfileInput;
  public type MutationResult = CommonTypes.MutationResult;

  /// State container for the single company profile record.
  public type State = { var profile : ?CompanyProfile };

  public func empty() : State { { var profile = null } };

  /// Returns the current company profile, or null if not yet configured.
  public func getCompanyProfile(state : State) : ?CompanyProfile {
    state.profile
  };

  /// Creates or replaces the company profile with the given input fields.
  /// Required fields: companyName, address, contactNumber.
  /// Any null field in input leaves the corresponding field unchanged (if profile exists).
  public func setCompanyProfile(
    state : State,
    input : UpdateCompanyProfileInput,
    now   : Int,
  ) : MutationResult {
    // Resolve new field values by merging with existing profile (if any)
    let existing = state.profile;

    let newName = switch (input.companyName) {
      case (?v) v;
      case null {
        switch (existing) {
          case (?p) p.companyName;
          case null "";
        };
      };
    };
    let newAddress = switch (input.address) {
      case (?v) v;
      case null {
        switch (existing) {
          case (?p) p.address;
          case null "";
        };
      };
    };
    let newContact = switch (input.contactNumber) {
      case (?v) v;
      case null {
        switch (existing) {
          case (?p) p.contactNumber;
          case null "";
        };
      };
    };

    // Validate required fields
    if (newName.size() == 0) {
      return #err("Required field missing: Company Name");
    };
    if (newAddress.size() == 0) {
      return #err("Required field missing: Address");
    };
    if (newContact.size() == 0) {
      return #err("Required field missing: Contact Number");
    };

    // Resolve optional fields
    let newLogoUrl = switch (input.logoUrl) {
      case (?v) ?v;
      case null {
        switch (existing) {
          case (?p) p.logoUrl;
          case null null;
        };
      };
    };
    let newEmailId = switch (input.emailId) {
      case (?v) ?v;
      case null {
        switch (existing) {
          case (?p) p.emailId;
          case null null;
        };
      };
    };
    let newWebsite = switch (input.website) {
      case (?v) ?v;
      case null {
        switch (existing) {
          case (?p) p.website;
          case null null;
        };
      };
    };

    state.profile := ?{
      logoUrl       = newLogoUrl;
      companyName   = newName;
      address       = newAddress;
      contactNumber = newContact;
      emailId       = newEmailId;
      website       = newWebsite;
      updatedAt     = now;
    };

    #ok
  };
};
