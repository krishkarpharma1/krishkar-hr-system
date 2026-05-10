import List  "mo:core/List";
import Map   "mo:core/Map";
import Text  "mo:core/Text";
import Time  "mo:core/Time";
import Types "../types/distributor";

/// Domain logic for Distributor Master.
/// Receives state by reference — no owned state.
module {

  func toInfo(d : Types.Distributor) : Types.DistributorInfo {
    {
      id           = d.id;
      name         = d.name;
      areaCode     = d.areaCode;
      address      = d.address;
      contactPerson = d.contactPerson;
      phone        = d.phone;
      email        = d.email;
      territory    = d.territory;
      creditLimit  = d.creditLimit;
      paymentTerms = d.paymentTerms;
      status       = d.status;
      createdAt    = d.createdAt;
      updatedAt    = d.updatedAt;
    };
  };

  /// Create a new distributor. Traps if the ID already exists.
  public func createDistributor(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    input        : Types.CreateDistributorInput,
  ) : Types.DistributorInfo {
    switch (distributors.get(input.id)) {
      case (?_) { return {
        id = input.id; name = ""; areaCode = ""; address = "";
        contactPerson = ""; phone = ""; email = ""; territory = "";
        creditLimit = 0; paymentTerms = ""; status = #inactive;
        createdAt = 0; updatedAt = 0;
      } }; // caller should check for duplicate
      case null {};
    };
    let now = Time.now();
    let d : Types.Distributor = {
      id           = input.id;
      var name     = input.name;
      var areaCode = input.areaCode;
      var address  = input.address;
      var contactPerson = input.contactPerson;
      var phone    = input.phone;
      var email    = input.email;
      var territory = input.territory;
      var creditLimit  = input.creditLimit;
      var paymentTerms = input.paymentTerms;
      var status   = #active;
      createdAt    = now;
      var updatedAt = now;
    };
    distributors.add(input.id, d);
    toInfo(d);
  };

  /// Update mutable fields of an existing distributor.
  public func updateDistributor(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    input        : Types.UpdateDistributorInput,
  ) : Bool {
    switch (distributors.get(input.id)) {
      case null false;
      case (?d) {
        switch (input.name)         { case (?v) { d.name         := v }; case null {} };
        switch (input.areaCode)     { case (?v) { d.areaCode     := v }; case null {} };
        switch (input.address)      { case (?v) { d.address      := v }; case null {} };
        switch (input.contactPerson){ case (?v) { d.contactPerson:= v }; case null {} };
        switch (input.phone)        { case (?v) { d.phone        := v }; case null {} };
        switch (input.email)        { case (?v) { d.email        := v }; case null {} };
        switch (input.territory)    { case (?v) { d.territory    := v }; case null {} };
        switch (input.creditLimit)  { case (?v) { d.creditLimit  := v }; case null {} };
        switch (input.paymentTerms) { case (?v) { d.paymentTerms := v }; case null {} };
        d.updatedAt := Time.now();
        true;
      };
    };
  };

  /// Soft-deactivate a distributor.
  public func deactivateDistributor(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    id           : Types.DistributorId,
  ) : Bool {
    switch (distributors.get(id)) {
      case null false;
      case (?d) { d.status := #inactive; d.updatedAt := Time.now(); true };
    };
  };

  public func getDistributor(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    id           : Types.DistributorId,
  ) : ?Types.DistributorInfo {
    switch (distributors.get(id)) {
      case (?d) ?toInfo(d);
      case null null;
    };
  };

  public func listDistributors(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
  ) : [Types.DistributorInfo] {
    distributors.values()
      .filter(func(d : Types.Distributor) : Bool { d.status == #active })
      .map<Types.Distributor, Types.DistributorInfo>(func(d) { toInfo(d) })
      .toArray();
  };

  public func listDistributorsByArea(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    areaCode     : Text,
  ) : [Types.DistributorInfo] {
    distributors.values()
      .filter(func(d : Types.Distributor) : Bool {
        d.status == #active and d.areaCode == areaCode
      })
      .map<Types.Distributor, Types.DistributorInfo>(func(d) { toInfo(d) })
      .toArray();
  };

  public func searchDistributors(
    distributors : Map.Map<Types.DistributorId, Types.Distributor>,
    searchTerm        : Text,
  ) : [Types.DistributorInfo] {
    let lq = searchTerm.toLower();
    distributors.values()
      .filter(func(d : Types.Distributor) : Bool {
        d.name.toLower().contains(#text lq) or
        d.id.toLower().contains(#text lq) or
        d.territory.toLower().contains(#text lq) or
        d.contactPerson.toLower().contains(#text lq)
      })
      .map<Types.Distributor, Types.DistributorInfo>(func(d) { toInfo(d) })
      .toArray();
  };
};
