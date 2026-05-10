module {
  /// Stored company profile — all branding fields for report headers and letterheads.
  public type CompanyProfile = {
    logoUrl       : ?Text;   // object-storage URL for the company logo
    companyName   : Text;
    address       : Text;
    contactNumber : Text;
    emailId       : ?Text;
    website       : ?Text;
    updatedAt     : Int;     // nanoseconds from Time.now()
  };

  /// Input for creating or updating the company profile (all fields optional for partial update).
  public type UpdateCompanyProfileInput = {
    logoUrl       : ?Text;
    companyName   : ?Text;
    address       : ?Text;
    contactNumber : ?Text;
    emailId       : ?Text;
    website       : ?Text;
  };
};
