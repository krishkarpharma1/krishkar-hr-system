import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  // ── Sample / Gift Product Master ─────────────────────────────────────────

  /// A product or gift item available for sample allocation and distribution.
  /// isSample = true  → medical sample (tracked against allocation)
  /// isGift   = true  → promotional gift (pen, diary, etc.)
  /// Both flags may be true simultaneously for combo items.
  public type SampleProductRecord = {
    id            : Nat;
    productId     : Nat;     // reference to Product in field-ops; 0 if standalone gift
    var productName  : Text;
    var productCode  : Text;
    var isSample     : Bool;
    var isGift       : Bool;
    var description  : Text;
    var isActive     : Bool;
    createdAt     : Timestamp;
  };

  public type SampleProductInfo = {
    id          : Nat;
    productId   : Nat;
    productName : Text;
    productCode : Text;
    isSample    : Bool;
    isGift      : Bool;
    description : Text;
    isActive    : Bool;
    createdAt   : Timestamp;
  };

  // ── Sample Allocation ─────────────────────────────────────────────────────

  /// Monthly allocation of a sample/gift product to one MR.
  /// balance = allocatedQty - usedQty  (computed by callers — not stored)
  public type SampleAllocationRecord = {
    id            : Nat;
    mrId          : UserId;
    productId     : Nat;
    var productName  : Text;
    month         : Nat;     // 1–12
    year          : Nat;     // e.g. 2025
    var allocatedQty : Int;
    var usedQty      : Int;
    allocatedBy   : UserId;  // Admin or HR who made the allocation
    allocatedAt   : Timestamp;
    var remarks   : Text;
  };

  public type SampleAllocationInfo = {
    id           : Nat;
    mrId         : UserId;
    productId    : Nat;
    productName  : Text;
    month        : Nat;
    year         : Nat;
    allocatedQty : Int;
    usedQty      : Int;
    allocatedBy  : UserId;
    allocatedAt  : Timestamp;
    remarks      : Text;
  };

  public type SampleAllocationInput = {
    mrId        : UserId;
    productId   : Nat;
    productName : Text;
    month       : Nat;
    year        : Nat;
    allocatedQty : Int;
    remarks     : Text;
  };

  // ── Sample Usage ──────────────────────────────────────────────────────────

  /// Auto-created when samples are recorded in a Doctor Call.
  /// Deducts from the MR's allocation balance.
  public type SampleUsageRecord = {
    id           : Nat;
    mrId         : UserId;
    callReportId : Nat;     // reference to CallReport or DcrRecord that triggered usage
    productId    : Nat;
    productName  : Text;
    qtyUsed      : Int;
    usedAt       : Timestamp;
    doctorId     : Nat;
    doctorName   : Text;
  };

  public type SampleUsageInfo = {
    id           : Nat;
    mrId         : UserId;
    callReportId : Nat;
    productId    : Nat;
    productName  : Text;
    qtyUsed      : Int;
    usedAt       : Timestamp;
    doctorId     : Nat;
    doctorName   : Text;
  };

  /// Input for recording sample usage inline during a Doctor Call.
  public type SampleUsageInput = {
    productId   : Nat;
    productName : Text;
    qtyUsed     : Int;
    doctorId    : Nat;
    doctorName  : Text;
  };

  // ── Balance View ──────────────────────────────────────────────────────────

  /// Computed view returned per product for an MR's sample balance report.
  /// remainingQty = allocatedQty - usedQty
  public type SampleBalanceView = {
    productId    : Nat;
    productName  : Text;
    productCode  : Text;
    allocatedQty : Int;
    usedQty      : Int;
    remainingQty : Int;
    month        : Nat;
    year         : Nat;
  };

  // ── Input for creating/updating a Sample Product record ───────────────────

  public type CreateSampleProductInput = {
    productId   : Nat;
    productName : Text;
    productCode : Text;
    isSample    : Bool;
    isGift      : Bool;
    description : Text;
  };
};
