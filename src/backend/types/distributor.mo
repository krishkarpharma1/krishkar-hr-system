module {
  public type DistributorId = Text;

  public type DistributorStatus = {
    #active;
    #inactive;
  };

  public type Distributor = {
    id            : DistributorId;
    var name      : Text;
    var areaCode  : Text;
    var address   : Text;
    var contactPerson : Text;
    var phone     : Text;
    var email     : Text;
    var territory : Text;
    var creditLimit  : Nat;   // in paise
    var paymentTerms : Text;  // e.g. "Net 30", "COD"
    var status    : DistributorStatus;
    createdAt     : Int;
    var updatedAt : Int;
  };

  public type DistributorInfo = {
    id           : DistributorId;
    name         : Text;
    areaCode     : Text;
    address      : Text;
    contactPerson : Text;
    phone        : Text;
    email        : Text;
    territory    : Text;
    creditLimit  : Nat;
    paymentTerms : Text;
    status       : DistributorStatus;
    createdAt    : Int;
    updatedAt    : Int;
  };

  public type CreateDistributorInput = {
    id           : DistributorId;  // Admin-assigned code
    name         : Text;
    areaCode     : Text;
    address      : Text;
    contactPerson : Text;
    phone        : Text;
    email        : Text;
    territory    : Text;
    creditLimit  : Nat;
    paymentTerms : Text;
  };

  public type UpdateDistributorInput = {
    id           : DistributorId;
    name         : ?Text;
    areaCode     : ?Text;
    address      : ?Text;
    contactPerson : ?Text;
    phone        : ?Text;
    email        : ?Text;
    territory    : ?Text;
    creditLimit  : ?Nat;
    paymentTerms : ?Text;
  };
};
