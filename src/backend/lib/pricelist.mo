import PLTypes "../types/pricelist";
import CommonTypes "../types/common";
import List "mo:core/List";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

module {
  public type PricelistProduct     = PLTypes.PricelistProduct;
  public type PricelistProductInfo = PLTypes.PricelistProductInfo;
  public type AddPricelistProductInput    = PLTypes.AddPricelistProductInput;
  public type UpdatePricelistProductInput = PLTypes.UpdatePricelistProductInput;
  public type BulkAddResult               = PLTypes.BulkAddResult;
  public type MutationResult              = CommonTypes.MutationResult;

  // ── State counters ──────────────────────────────────────────────────────────

  /// Mutable counter that tracks the next product ID.
  public type NextId = { var val : Nat };

  /// Mutable counter that tracks the next globally sequential Sr. No.
  /// Sr. No. is never reused even if a product is deleted.
  public type NextSrNo = { var val : Nat };

  // ── Internal helpers ────────────────────────────────────────────────────────

  /// Convert internal record to the public info shape (they are structurally identical).
  public func toInfo(p : PricelistProduct) : PricelistProductInfo {
    {
      id          = p.id;
      srNo        = p.srNo;
      name        = p.name;
      composition = p.composition;
      mrp         = p.mrp;
      pts         = p.pts;
      ptr         = p.ptr;
      createdAt   = p.createdAt;
      updatedAt   = p.updatedAt;
    }
  };

  /// Case-insensitive duplicate name check.
  func isDuplicateName(
    products : List.List<PricelistProduct>,
    name     : Text,
    excludeId : ?Nat,
  ) : Bool {
    let lower = name.toLower();
    switch (products.find(func(p : PricelistProduct) : Bool {
      p.name.toLower() == lower and (
        switch excludeId {
          case (?eid) p.id != eid;
          case null   true;
        }
      )
    })) {
      case (?_) true;
      case null false;
    };
  };

  // ── Domain operations ───────────────────────────────────────────────────────

  /// Add a single pricelist product. Returns #err if the name already exists.
  public func addPricelistProduct(
    products   : List.List<PricelistProduct>,
    nextId     : NextId,
    nextSrNo   : NextSrNo,
    input      : AddPricelistProductInput,
    now        : Int,
  ) : MutationResult {
    if (isDuplicateName(products, input.name, null)) {
      return #err("A product with name \"" # input.name # "\" already exists");
    };

    let id   = nextId.val;
    let srNo = nextSrNo.val;
    nextId.val   += 1;
    nextSrNo.val += 1;

    products.add({
      id;
      srNo;
      name        = input.name;
      composition = input.composition;
      mrp         = input.mrp;
      pts         = input.pts;
      ptr         = input.ptr;
      createdAt   = now;
      updatedAt   = now;
    });

    #ok
  };

  /// Update an existing pricelist product. Returns #err if not found or name duplicates.
  public func updatePricelistProduct(
    products : List.List<PricelistProduct>,
    id       : Nat,
    input    : UpdatePricelistProductInput,
    now      : Int,
  ) : MutationResult {
    switch (products.findIndex(func(p : PricelistProduct) : Bool { p.id == id })) {
      case null { return #err("Product not found") };
      case (?idx) {
        let existing = products.at(idx);

        // Check for name conflict when name is being changed
        let newName = switch (input.name) {
          case (?n) n;
          case null existing.name;
        };
        if (newName.toLower() != existing.name.toLower()) {
          if (isDuplicateName(products, newName, ?id)) {
            return #err("A product with name \"" # newName # "\" already exists");
          };
        };

        products.put(idx, {
          existing with
          name        = newName;
          composition = switch (input.composition) { case (?v) v; case null existing.composition };
          mrp         = switch (input.mrp)         { case (?v) v; case null existing.mrp         };
          pts         = switch (input.pts)         { case (?v) v; case null existing.pts         };
          ptr         = switch (input.ptr)         { case (?v) v; case null existing.ptr         };
          updatedAt   = now;
        });
        #ok
      };
    };
  };

  /// Delete a pricelist product by ID. Sr. No. is NOT reused.
  public func deletePricelistProduct(
    products : List.List<PricelistProduct>,
    id       : Nat,
  ) : MutationResult {
    switch (products.findIndex(func(p : PricelistProduct) : Bool { p.id == id })) {
      case null { #err("Product not found") };
      case (?idx) {
        // Remove by rebuilding the list without this element
        let kept = products.filter(func(p : PricelistProduct) : Bool { p.id != id });
        products.clear();
        products.append(kept);
        #ok
      };
    };
  };

  /// Return all products as a sorted array of PricelistProductInfo (sorted by srNo ascending).
  public func listPricelistProducts(
    products : List.List<PricelistProduct>,
  ) : [PricelistProductInfo] {
    let sorted = products.sort(func(a : PricelistProduct, b : PricelistProduct) : Order.Order {
      if (a.srNo < b.srNo) #less
      else if (a.srNo > b.srNo) #greater
      else #equal
    });
    sorted.map<PricelistProduct, PricelistProductInfo>(func(p) { toInfo(p) }).toArray()
  };

  /// Bulk-add multiple products. Skips duplicates with an error message per row.
  public func bulkAddPricelistProducts(
    products : List.List<PricelistProduct>,
    nextId   : NextId,
    nextSrNo : NextSrNo,
    inputs   : [AddPricelistProductInput],
    now      : Int,
  ) : BulkAddResult {
    var added  : Nat   = 0;
    let errors : List.List<Text> = List.empty();

    for (input in inputs.values()) {
      if (isDuplicateName(products, input.name, null)) {
        errors.add("Duplicate name skipped: \"" # input.name # "\"");
      } else {
        let id   = nextId.val;
        let srNo = nextSrNo.val;
        nextId.val   += 1;
        nextSrNo.val += 1;
        products.add({
          id;
          srNo;
          name        = input.name;
          composition = input.composition;
          mrp         = input.mrp;
          pts         = input.pts;
          ptr         = input.ptr;
          createdAt   = now;
          updatedAt   = now;
        });
        added += 1;
      };
    };

    { added; errors = errors.toArray() }
  };
};
