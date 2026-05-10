import List "mo:core/List";
import Map "mo:core/Map";
import Set "mo:core/Set";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Debug "mo:core/Debug";
import Types "../types/field-ops";
import CommonTypes "../types/common";
import LocTypes "../types/location-master";
import AuthTypes "../types/auth-users";
import ACTypes "../types/additional-charge";

/// Domain logic for MR field operations.
/// Receives state by reference — no owned state.
module {

  /// Convert Role variant to text string for DA config lookup.
  public func roleToText(role : CommonTypes.Role) : Text {
    switch (role) {
      case (#MR)        "MR";
      case (#ASM)       "ASM";
      case (#RSM)       "RSM";
      case (#ZSM)       "ZSM";
      case (#HRManager) "HRManager";
      case (#Admin)     "Admin";
    };
  };

  // ── Helper: toInfo converters ─────────────────────────────────────────────

  /// Extract YYYY from "YYYY-MM-DD"
  func dateYearFromDate(date : Text) : Nat {
    let parts = date.split(#char '-').toArray();
    if (parts.size() < 1) return 0;
    switch (Nat.fromText(parts[0])) { case (?y) y; case null 0 };
  };

  /// Extract MM (1-12) from "YYYY-MM-DD"
  func dateMonthFromDate(date : Text) : Nat {
    let parts = date.split(#char '-').toArray();
    if (parts.size() < 2) return 0;
    switch (Nat.fromText(parts[1])) { case (?m) m; case null 0 };
  };

  func productToInfo(p : Types.Product) : Types.ProductInfo {
    {
      id          = p.id;
      name        = p.name;
      category    = p.category;
      description = p.description;
      isActive    = p.isActive;
      productCode = p.productCode;
      division    = p.division;
      mrpPaise    = p.mrpPaise;
      packSize    = p.packSize;
      createdAt   = p.createdAt;
    };
  };

  func doctorToInfo(d : Types.Doctor, dobMap : Map.Map<Text, Text>) : Types.DoctorInfo {
    {
      id             = d.id;
      name           = d.name;
      qualification  = d.qualification;
      station        = d.station;
      area           = d.area;
      territory      = d.territory;
      specialization = d.specialization;
      contactPhone   = d.contactPhone;
      isActive       = d.isActive;
      createdBy      = d.createdBy;
      createdAt      = d.createdAt;
      clinicName     = d.clinicName;
      address        = d.address;
      hqId           = 0;
      areaId         = 0;
      email          = d.email;
      category       = d.category;
      assignedMRId   = d.createdBy;
      dateOfBirth    = dobMap.get(d.id.toText());
      isCoreDoctor   = d.isCoreDoctor;
      visitFrequencyTarget = d.visitFrequencyTarget;
    };
  };

  func chemistToInfo(c : Types.Chemist) : Types.ChemistInfo {
    {
      id           = c.id;
      name         = c.name;
      shopName     = c.shopName;
      address      = c.address;
      area         = c.area;
      territory    = c.territory;
      contactPhone = c.contactPhone;
      isActive     = c.isActive;
      createdBy    = c.createdBy;
      createdAt    = c.createdAt;
    };
  };

  func orderToInfo(o : Types.ChemistOrder) : Types.ChemistOrderInfo {
    {
      id          = o.id;
      chemistId   = o.chemistId;
      mrId        = o.mrId;
      date        = o.date;
      items       = o.items;
      totalValue  = o.totalValue;
      status      = o.status;
      remarks     = o.remarks;
      gpsLocation = o.gpsLocation;
      createdAt   = o.createdAt;
    };
  };

  func reportToInfo(r : Types.CallReport) : Types.CallReportInfo {
    {
      id                   = r.id;
      mrId                 = r.mrId;
      date                 = r.date;
      gps                  = r.gps;
      doctorsVisited       = r.doctorsVisited;
      samplesDistributed   = r.samplesDistributed;
      workType             = r.workType;
      startLocation        = r.startLocation;
      endLocation          = r.endLocation;
      remarks              = r.remarks;
      status               = r.status;
      reviewedBy           = r.reviewedBy;
      reviewNote           = r.reviewNote;
      reviewedAt           = r.reviewedAt;
      stationType          = r.stationType;
      daAmount             = r.daAmount;
      workingMode          = r.workingMode;
      workingWithUserId    = r.workingWithUserId;
      workingWithUserName  = r.workingWithUserName;
      workingStation       = r.workingStation;
      workingStationSource = r.workingStationSource;
      createdAt            = r.createdAt;
      updatedAt            = r.updatedAt;
    };
  };

  // ── Products ──────────────────────────────────────────────────────────────

  public func addProduct(
    products : List.List<Types.Product>,
    nextId   : { var val : Nat },
    input    : Types.CreateProductInput,
    now      : Types.Timestamp,
  ) : Types.ProductId {
    let id = nextId.val;
    nextId.val += 1;
    let product : Types.Product = {
      id;
      var name        = input.name;
      var category    = input.category;
      var description = input.description;
      var isActive    = true;
      var productCode = input.productCode;
      var division    = input.division;
      var mrpPaise    = input.mrpPaise;
      var packSize    = input.packSize;
      createdAt       = now;
    };
    products.add(product);
    id;
  };

  public func getProduct(
    products  : List.List<Types.Product>,
    productId : Types.ProductId,
  ) : ?Types.ProductInfo {
    switch (products.find(func(p : Types.Product) : Bool { p.id == productId })) {
      case (?p) ?productToInfo(p);
      case null null;
    };
  };

  public func listProducts(products : List.List<Types.Product>) : [Types.ProductInfo] {
    products.filter(func(p : Types.Product) : Bool { p.isActive })
            .map<Types.Product, Types.ProductInfo>(func(p) { productToInfo(p) })
            .toArray();
  };

  public func updateProduct(
    products  : List.List<Types.Product>,
    productId : Types.ProductId,
    name      : ?Text,
    category  : ?Types.ProductCategory,
    description : ?Text,
    productCode : ?Text,
    division    : ?Text,
    mrpPaise    : ?Nat,
    packSize    : ?Text,
  ) : Types.MutationResult {
    switch (products.find(func(p : Types.Product) : Bool { p.id == productId })) {
      case null #err("Product not found");
      case (?p) {
        switch (name)        { case (?n) { p.name        := n }; case null {} };
        switch (category)    { case (?c) { p.category    := c }; case null {} };
        switch (description) { case (?d) { p.description := d }; case null {} };
        switch (productCode) { case (?v) { p.productCode := v }; case null {} };
        switch (division)    { case (?v) { p.division    := v }; case null {} };
        switch (mrpPaise)    { case (?v) { p.mrpPaise    := v }; case null {} };
        switch (packSize)    { case (?v) { p.packSize    := v }; case null {} };
        #ok;
      };
    };
  };

  public func deactivateProduct(
    products  : List.List<Types.Product>,
    productId : Types.ProductId,
  ) : Types.MutationResult {
    switch (products.find(func(p : Types.Product) : Bool { p.id == productId })) {
      case null #err("Product not found");
      case (?p) { p.isActive := false; #ok };
    };
  };

  // ── Doctors ───────────────────────────────────────────────────────────────

  public func addDoctor(
    doctors : List.List<Types.Doctor>,
    nextId  : { var val : Nat },
    dobMap  : Map.Map<Text, Text>,
    mrId    : Types.UserId,
    input   : Types.CreateDoctorInput,
    now     : Types.Timestamp,
  ) : Types.DoctorId {
    let id = nextId.val;
    nextId.val += 1;
    let doctor : Types.Doctor = {
      id;
      var name           = input.name;
      var qualification  = input.qualification;
      var station        = input.station;
      var area           = input.area;
      var territory      = input.territory;
      var specialization = input.specialization;
      var contactPhone   = input.contactPhone;
      var isActive       = true;
      var category       = "";
      var email          = "";
      var clinicName     = "";
      var address        = "";
      var isCoreDoctor   = false;
      var visitFrequencyTarget = 0;
      createdBy          = mrId;
      createdAt          = now;
    };
    doctors.add(doctor);
    // Store DOB in external map if provided
    switch (input.dateOfBirth) {
      case (?dob) { dobMap.add(id.toText(), dob) };
      case null {};
    };
    id;
  };

  public func getDoctor(
    doctors  : List.List<Types.Doctor>,
    dobMap   : Map.Map<Text, Text>,
    doctorId : Types.DoctorId,
  ) : ?Types.DoctorInfo {
    switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
      case (?d) ?doctorToInfo(d, dobMap);
      case null null;
    };
  };

  public func listDoctors(doctors : List.List<Types.Doctor>, dobMap : Map.Map<Text, Text>) : [Types.DoctorInfo] {
    doctors.filter(func(d : Types.Doctor) : Bool { d.isActive })
           .map<Types.Doctor, Types.DoctorInfo>(func(d) { doctorToInfo(d, dobMap) })
           .toArray();
  };

  public func listDoctorsByTerritory(
    doctors   : List.List<Types.Doctor>,
    dobMap    : Map.Map<Text, Text>,
    territory : Text,
  ) : [Types.DoctorInfo] {
    doctors.filter(func(d : Types.Doctor) : Bool { d.isActive and d.territory == territory })
           .map<Types.Doctor, Types.DoctorInfo>(func(d) { doctorToInfo(d, dobMap) })
           .toArray();
  };

  public func listDoctorsByMr(
    doctors : List.List<Types.Doctor>,
    dobMap  : Map.Map<Text, Text>,
    mrId    : Types.UserId,
  ) : [Types.DoctorInfo] {
    doctors.filter(func(d : Types.Doctor) : Bool { d.isActive and d.createdBy == mrId })
           .map<Types.Doctor, Types.DoctorInfo>(func(d) { doctorToInfo(d, dobMap) })
           .toArray();
  };

  public func updateDoctor(
    doctors  : List.List<Types.Doctor>,
    doctorId : Types.DoctorId,
    mrId     : Types.UserId,
    name     : ?Text,
    station  : ?Text,
    area     : ?Text,
    territory : ?Text,
    specialization : ?Text,
    contactPhone : ?Text,
  ) : Types.MutationResult {
    switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
      case null #err("Doctor not found");
      case (?d) {
        if (d.createdBy != mrId) return #err("Not authorized to update this doctor");
        switch (name)           { case (?v) { d.name           := v }; case null {} };
        switch (station)        { case (?v) { d.station        := v }; case null {} };
        switch (area)           { case (?v) { d.area           := v }; case null {} };
        switch (territory)      { case (?v) { d.territory      := v }; case null {} };
        switch (specialization) { case (?v) { d.specialization := v }; case null {} };
        switch (contactPhone)   { case (?v) { d.contactPhone   := v }; case null {} };
        #ok;
      };
    };
  };

  /// Set Core/Non-Core classification and visit frequency target for a doctor.
  /// Callable by Admin, HR, ASM, or RSM (when directly managing the MR).
  public func setDoctorClassification(
    doctors              : List.List<Types.Doctor>,
    doctorId             : Types.DoctorId,
    isCoreDoctor         : Bool,
    visitFrequencyTarget : Nat,
  ) : Types.MutationResult {
    switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
      case null #err("Doctor not found");
      case (?d) {
        d.isCoreDoctor         := isCoreDoctor;
        d.visitFrequencyTarget := visitFrequencyTarget;
        #ok;
      };
    };
  };

  /// Update doctor without ownership check — for Admin/HR use.
  /// Handles all editable fields on the Doctor record including category, email,
  /// clinicName, address, and isActive. Unset optional fields keep existing values.
  /// dobMap is the external dateOfBirth storage map (keyed by doctorId.toText()).
  public func updateDoctorAdmin(
    doctors    : List.List<Types.Doctor>,
    auditLogs  : List.List<Types.AllotmentAuditLog>,
    nextLogId  : { var val : Nat },
    dobMap     : Map.Map<Text, Text>,
    doctorId   : Types.DoctorId,
    updatedBy  : Types.UserId,
    name          : ?Text,
    qualification : ?Types.DoctorQualification,
    station       : ?Text,
    area          : ?Text,
    territory     : ?Text,
    specialization : ?Text,
    contactPhone  : ?Text,
    category      : ?Text,
    email         : ?Text,
    clinicName    : ?Text,
    address       : ?Text,
    isActive      : ?Bool,
    dateOfBirth   : ?Text,
    now           : Int,
  ) : Types.MutationResult {
    Debug.print("[updateDoctorAdmin] called: doctorId=" # doctorId.toText() # " updatedBy=" # updatedBy.toText());
    switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
      case null {
        Debug.print("[updateDoctorAdmin] ERROR: Doctor not found for id=" # doctorId.toText());
        #err("Doctor not found: ID " # doctorId.toText());
      };
      case (?d) {
        let oldName = d.name;
        // Apply each optional field — only update if provided, keep existing value otherwise
        switch (name)           {
          case (?v) {
            if (v == "") { Debug.print("[updateDoctorAdmin] WARN: name is empty string for doctorId=" # doctorId.toText()) };
            d.name := v;
          };
          case null {};
        };
        switch (qualification)  { case (?v) { d.qualification  := v }; case null {} };
        switch (station)        {
          case (?v) { d.station := v };
          case null {};
        };
        switch (area)           { case (?v) { d.area           := v }; case null {} };
        switch (territory)      { case (?v) { d.territory      := v }; case null {} };
        switch (specialization) { case (?v) { d.specialization := v }; case null {} };
        switch (contactPhone)   { case (?v) { d.contactPhone   := v }; case null {} };
        switch (category)       { case (?v) { d.category       := v }; case null {} };
        switch (email)          { case (?v) { d.email          := v }; case null {} };
        switch (clinicName)     { case (?v) { d.clinicName     := v }; case null {} };
        switch (address)        { case (?v) { d.address        := v }; case null {} };
        switch (isActive)       { case (?v) { d.isActive       := v }; case null {} };
        // Store DOB in external map instead of on the mutable struct
        switch (dateOfBirth)    { case (?v) { dobMap.add(doctorId.toText(), v) }; case null {} };
        Debug.print("[updateDoctorAdmin] SUCCESS: doctor updated. id=" # doctorId.toText() # " name=" # d.name);
        // Audit log
        let lid = nextLogId.val;
        nextLogId.val += 1;
        auditLogs.add({
          logId         = lid;
          actionType    = #Edit;
          performedBy   = updatedBy;
          performedAt   = now;
          doctorId      = ?doctorId;
          doctorDetails = ?oldName;
          mrId          = null;
          changes       = "Doctor record updated by Admin/HR: " # d.name;
        });
        #ok;
      };
    };
  };

  // ── Doctor product assignments ────────────────────────────────────────────

  func assignmentKey(mrId : Types.UserId, doctorId : Types.DoctorId) : (Types.UserId, Types.DoctorId) {
    (mrId, doctorId);
  };

  func pairCompare(a : (Nat, Nat), b : (Nat, Nat)) : { #less; #equal; #greater } {
    let c1 = Nat.compare(a.0, b.0);
    if (c1 != #equal) c1
    else Nat.compare(a.1, b.1);
  };

  public func assignProductsToDoctor(
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    mrId        : Types.UserId,
    input       : Types.AssignProductsInput,
    now         : Types.Timestamp,
  ) : () {
    let key = assignmentKey(mrId, input.doctorId);
    let entry : Types.DoctorProductAssignment = {
      doctorId   = input.doctorId;
      mrId;
      productIds = input.productIds;
      sampleIds  = input.sampleIds;
      updatedAt  = now;
    };
    assignments.add(pairCompare, key, entry);
  };

  public func getDoctorAssignment(
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    mrId        : Types.UserId,
    doctorId    : Types.DoctorId,
  ) : ?Types.DoctorProductAssignment {
    assignments.get(pairCompare, assignmentKey(mrId, doctorId));
  };

  public func listAssignmentsByMr(
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    mrId        : Types.UserId,
  ) : [Types.DoctorProductAssignment] {
    let result = List.empty<Types.DoctorProductAssignment>();
    for ((_, v) in assignments.entries()) {
      if (v.mrId == mrId) { result.add(v) };
    };
    result.toArray();
  };

  // ── Chemists ──────────────────────────────────────────────────────────────

  public func addChemist(
    chemists : List.List<Types.Chemist>,
    nextId   : { var val : Nat },
    mrId     : Types.UserId,
    input    : Types.CreateChemistInput,
    now      : Types.Timestamp,
  ) : Types.ChemistId {
    let id = nextId.val;
    nextId.val += 1;
    let chemist : Types.Chemist = {
      id;
      var name         = input.name;
      var shopName     = input.shopName;
      var address      = input.address;
      var area         = input.area;
      var territory    = input.territory;
      var contactPhone = input.contactPhone;
      var isActive     = true;
      createdBy        = mrId;
      createdAt        = now;
    };
    chemists.add(chemist);
    id;
  };

  public func getChemist(
    chemists  : List.List<Types.Chemist>,
    chemistId : Types.ChemistId,
  ) : ?Types.ChemistInfo {
    switch (chemists.find(func(c : Types.Chemist) : Bool { c.id == chemistId })) {
      case (?c) ?chemistToInfo(c);
      case null null;
    };
  };

  public func listChemists(chemists : List.List<Types.Chemist>) : [Types.ChemistInfo] {
    chemists.filter(func(c : Types.Chemist) : Bool { c.isActive })
            .map<Types.Chemist, Types.ChemistInfo>(func(c) { chemistToInfo(c) })
            .toArray();
  };

  public func listChemistsByTerritory(
    chemists  : List.List<Types.Chemist>,
    territory : Text,
  ) : [Types.ChemistInfo] {
    chemists.filter(func(c : Types.Chemist) : Bool { c.isActive and c.territory == territory })
            .map<Types.Chemist, Types.ChemistInfo>(func(c) { chemistToInfo(c) })
            .toArray();
  };

  public func listChemistsByMr(
    chemists : List.List<Types.Chemist>,
    mrId     : Types.UserId,
  ) : [Types.ChemistInfo] {
    chemists.filter(func(c : Types.Chemist) : Bool { c.isActive and c.createdBy == mrId })
            .map<Types.Chemist, Types.ChemistInfo>(func(c) { chemistToInfo(c) })
            .toArray();
  };

  // ── Chemist orders ────────────────────────────────────────────────────────

  public func createOrder(
    orders : List.List<Types.ChemistOrder>,
    nextId : { var val : Nat },
    mrId   : Types.UserId,
    input  : Types.CreateOrderInput,
    now    : Types.Timestamp,
  ) : Types.OrderId {
    let id = nextId.val;
    nextId.val += 1;
    let order : Types.ChemistOrder = {
      id;
      chemistId       = input.chemistId;
      mrId;
      date            = input.date;
      var items       = input.items;
      var totalValue  = input.totalValue;
      var status      = #Pending;
      var remarks     = input.remarks;
      gpsLocation     = input.gpsLocation;
      createdAt       = now;
    };
    orders.add(order);
    id;
  };

  public func getOrder(
    orders  : List.List<Types.ChemistOrder>,
    orderId : Types.OrderId,
  ) : ?Types.ChemistOrderInfo {
    switch (orders.find(func(o : Types.ChemistOrder) : Bool { o.id == orderId })) {
      case (?o) ?orderToInfo(o);
      case null null;
    };
  };

  public func listOrdersByMr(
    orders : List.List<Types.ChemistOrder>,
    mrId   : Types.UserId,
  ) : [Types.ChemistOrderInfo] {
    orders.filter(func(o : Types.ChemistOrder) : Bool { o.mrId == mrId })
          .map<Types.ChemistOrder, Types.ChemistOrderInfo>(func(o) { orderToInfo(o) })
          .toArray();
  };

  public func listOrdersByChemist(
    orders    : List.List<Types.ChemistOrder>,
    chemistId : Types.ChemistId,
  ) : [Types.ChemistOrderInfo] {
    orders.filter(func(o : Types.ChemistOrder) : Bool { o.chemistId == chemistId })
          .map<Types.ChemistOrder, Types.ChemistOrderInfo>(func(o) { orderToInfo(o) })
          .toArray();
  };

  public func updateOrderStatus(
    orders  : List.List<Types.ChemistOrder>,
    orderId : Types.OrderId,
    status  : Types.OrderStatus,
  ) : Types.MutationResult {
    switch (orders.find(func(o : Types.ChemistOrder) : Bool { o.id == orderId })) {
      case null #err("Order not found");
      case (?o) { o.status := status; #ok };
    };
  };

  // ── Daily call reports ────────────────────────────────────────────────────

  public func createReport(
    reports : List.List<Types.CallReport>,
    nextId  : { var val : Nat },
    mrId    : Types.UserId,
    input   : Types.CreateReportInput,
    now     : Types.Timestamp,
  ) : Types.ReportId {
    let id = nextId.val;
    nextId.val += 1;
    let report : Types.CallReport = {
      id;
      mrId;
      date                       = input.date;
      gps                        = input.gps;
      var doctorsVisited         = input.doctorsVisited;
      var samplesDistributed     = input.samplesDistributed;
      var workType               = input.workType;
      var startLocation          = input.startLocation;
      var endLocation            = input.endLocation;
      var remarks                = input.remarks;
      var status                 = #Draft;
      var reviewedBy             = null;
      var reviewNote             = "";
      var reviewedAt             = null;
      var stationType            = input.stationType;
      var daAmount               = 0;  // calculated on submit
      var workingMode            = input.workingMode;
      var workingWithUserId      = input.workingWithUserId;
      var workingWithUserName    = input.workingWithUserName;
      var workingStation         = input.workingStation;
      var workingStationSource   = input.workingStationSource;
      createdAt                  = now;
      var updatedAt              = now;
    };
    reports.add(report);
    id;
  };

  /// Calculate DA for a report based on role and station type using daConfigs map.
  /// Returns 0 if no matching config found.
  /// Role matching is case-insensitive.
  /// DA is a FLAT rate per day — never multiplied by distance.
  public func calculateDa(
    daConfigs   : Map.Map<Text, Types.DaConfig>,
    role        : Text,
    stationType : Text,
  ) : Nat {
    // Normalise role text for DA config lookup
    let normRole = switch (role.toUpper()) {
      case "MR"  "MR";
      case "ASM" "ASM";
      case "RSM" "RSM";
      case "ZSM" "ZSM";
      case _     role.toUpper();
    };
    Debug.print("[calculateDa] role=" # role # " normRole=" # normRole # " stationType=" # stationType);
    let daAmount = switch (daConfigs.get(normRole)) {
      case null {
        Debug.print("[calculateDa] WARN: No DA config found for role=" # normRole # ". Returning 0.");
        0;
      };
      case (?cfg) {
        // DA is a FLAT rate per day — no multiplication by distance
        switch (stationType) {
          case "HQ"         cfg.hqRate;
          case "ExStation"  cfg.exStationRate;
          case "OutStation" cfg.outStationRate;
          case _ {
            Debug.print("[calculateDa] WARN: Unknown stationType='" # stationType # "' for role=" # normRole # ". Returning 0.");
            0;
          };
        };
      };
    };
    // Safety check: warn if DA amount exceeds Rs. 5,000 (500000 paise) for field roles
    let isFieldRole = normRole == "MR" or normRole == "ASM" or normRole == "RSM" or normRole == "ZSM";
    if (isFieldRole and daAmount > 500000) {
      Debug.print("[calculateDa] WARNING: DA amount " # daAmount.toText() # " paise exceeds Rs.5000 threshold for role=" # normRole # " stationType=" # stationType # ". Check for calculation error.");
    };
    Debug.print("[calculateDa] result: role=" # normRole # " stationType=" # stationType # " daAmount=" # daAmount.toText() # " paise");
    daAmount;
  };

  public func submitReport(
    reports     : List.List<Types.CallReport>,
    reportId    : Types.ReportId,
    mrId        : Types.UserId,
    role        : Text,
    daConfigs   : Map.Map<Text, Types.DaConfig>,
    now         : Types.Timestamp,
  ) : Types.MutationResult {
    switch (reports.find(func(r : Types.CallReport) : Bool { r.id == reportId })) {
      case null #err("Report not found");
      case (?r) {
        if (r.mrId != mrId) return #err("Not authorized to submit this report");
        if (r.status != #Draft) return #err("Report is not in draft state");
        // DA is flat rate per day — never multiplied by distance
        let da = calculateDa(daConfigs, role, r.stationType);
        Debug.print("[submitReport] reportId=" # reportId.toText() # " mrId=" # mrId.toText() # " role=" # role # " stationType=" # r.stationType # " calculatedDA=" # da.toText() # " paise");
        r.daAmount  := da;
        r.status    := #Submitted;
        r.updatedAt := now;
        #ok;
      };
    };
  };

  public func getReport(
    reports  : List.List<Types.CallReport>,
    reportId : Types.ReportId,
  ) : ?Types.CallReportInfo {
    switch (reports.find(func(r : Types.CallReport) : Bool { r.id == reportId })) {
      case (?r) ?reportToInfo(r);
      case null null;
    };
  };

  public func listReportsByMr(
    reports : List.List<Types.CallReport>,
    mrId    : Types.UserId,
  ) : [Types.CallReportInfo] {
    reports.filter(func(r : Types.CallReport) : Bool { r.mrId == mrId })
           .map<Types.CallReport, Types.CallReportInfo>(func(r) { reportToInfo(r) })
           .toArray();
  };

  public func listReportsByMrAndMonth(
    reports : List.List<Types.CallReport>,
    mrId    : Types.UserId,
    month   : Text,   // "YYYY-MM"
  ) : [Types.CallReportInfo] {
    reports.filter(func(r : Types.CallReport) : Bool {
             r.mrId == mrId and r.date.size() >= 7 and r.date.startsWith(#text month)
           })
           .map<Types.CallReport, Types.CallReportInfo>(func(r) { reportToInfo(r) })
           .toArray();
  };

  public func listSubmittedReports(
    reports : List.List<Types.CallReport>,
  ) : [Types.CallReportInfo] {
    reports.filter(func(r : Types.CallReport) : Bool { r.status == #Submitted })
           .map<Types.CallReport, Types.CallReportInfo>(func(r) { reportToInfo(r) })
           .toArray();
  };

  public func reviewReport(
    reports    : List.List<Types.CallReport>,
    reportId   : Types.ReportId,
    reviewerId : Types.UserId,
    approved   : Bool,
    note       : Text,
    now        : Types.Timestamp,
  ) : Types.MutationResult {
    switch (reports.find(func(r : Types.CallReport) : Bool { r.id == reportId })) {
      case null #err("Report not found");
      case (?r) {
        if (r.status != #Submitted) return #err("Report is not in submitted state");
        r.status     := if (approved) #Approved else #Rejected;
        r.reviewedBy := ?reviewerId;
        r.reviewNote := note;
        r.reviewedAt := ?now;
        r.updatedAt  := now;
        #ok;
      };
    };
  };

  /// Returns the most recent N call reports that include the given doctor.
  public func getDoctorVisitHistory(
    reports  : List.List<Types.CallReport>,
    doctorId : Types.DoctorId,
    limit    : Nat,
  ) : [Types.CallReportInfo] {
    // Filter reports that contain this doctor in doctorsVisited
    let matching = reports.filter(func(r : Types.CallReport) : Bool {
      r.doctorsVisited.any(func(v : Types.DoctorVisitEntry) : Bool { v.doctorId == doctorId })
    });
    // Sort descending by date (text comparison works for ISO dates)
    let sorted = matching.sort(func(a : Types.CallReport, b : Types.CallReport) : { #less; #equal; #greater } {
      // Reverse order: b compared to a
      if (b.date > a.date) #less
      else if (b.date < a.date) #greater
      else #equal
    });
    // Take first `limit` entries
    let taken = sorted.values().take(limit).toArray();
    taken.map<Types.CallReport, Types.CallReportInfo>(func(r) { reportToInfo(r) });
  };

  /// Returns submitted/approved DCRs for a user in a given month/year,
  /// aggregated as daily DA history rows for the 30-day working detail view.
  public func getDaHistory(
    reports    : List.List<Types.CallReport>,
    mrId       : Types.UserId,
    month      : Nat,
    year       : Nat,
  ) : [Types.DaHistoryRow] {
    let matching = reports.filter(func(r : Types.CallReport) : Bool {
      r.mrId == mrId and
      (r.status == #Submitted or r.status == #Approved) and
      dateMonthFromDate(r.date) == month and
      dateYearFromDate(r.date) == year
    });
    // Sort ascending by date
    let sorted = matching.sort(func(a : Types.CallReport, b : Types.CallReport) : { #less; #equal; #greater } {
      if (a.date < b.date) #less
      else if (a.date > b.date) #greater
      else #equal
    });
    sorted.toArray().map<Types.CallReport, Types.DaHistoryRow>(func(r) {
      {
        date        = r.date;
        doctorCount = r.doctorsVisited.size();
        stationType = r.stationType;
        daAmount    = r.daAmount;
      }
    });
  };

  // ── DA Configuration ──────────────────────────────────────────────────────

  /// Get all DA configs as an array.
  public func getDaConfigs(
    daConfigs : Map.Map<Text, Types.DaConfig>,
  ) : [Types.DaConfig] {
    daConfigs.values().toArray();
  };

  /// Upsert all provided DA configs (keyed by role name).
  public func setDaConfigs(
    daConfigs : Map.Map<Text, Types.DaConfig>,
    configs   : [Types.DaConfig],
  ) : () {
    for (cfg in configs.values()) {
      daConfigs.add(cfg.role, cfg);
    };
  };

  /// Sum of daAmount across all Submitted/Approved call reports for an employee in a month/year.
  /// Used by payroll processing to include DCR-based DA in the salary slip.
  public func getApprovedDaForMonth(
    reports    : List.List<Types.CallReport>,
    employeeId : Types.UserId,
    month      : Nat,
    year       : Nat,
  ) : Nat {
    reports.foldLeft<Nat, Types.CallReport>(0, func(acc, r) {
      if (
        r.mrId == employeeId and
        (r.status == #Submitted or r.status == #Approved) and
        dateMonthFromDate(r.date) == month and
        dateYearFromDate(r.date) == year
      ) {
        acc + r.daAmount
      } else { acc };
    });
  };

  // ── Analytics ─────────────────────────────────────────────────────────────

  public func getMrMonthlySummary(
    reports : List.List<Types.CallReport>,
    orders  : List.List<Types.ChemistOrder>,
    mrId    : Types.UserId,
    month   : Text,
  ) : Types.MrMonthlySummary {
    let mrReports = reports.filter(func(r : Types.CallReport) : Bool {
      r.mrId == mrId and r.date.size() >= 7 and r.date.startsWith(#text month)
    });

    let totalCalls = mrReports.size();

    // Collect unique doctor IDs visited this month
    let doctorSet = Set.empty<Types.DoctorId>();
    mrReports.forEach(func(r : Types.CallReport) {
      for (v in r.doctorsVisited.values()) {
        doctorSet.add(v.doctorId);
      };
    });
    let uniqueDoctors = doctorSet.size();

    let mrOrders = orders.filter(func(o : Types.ChemistOrder) : Bool {
      o.mrId == mrId and o.date.size() >= 7 and o.date.startsWith(#text month)
    });
    let totalOrders = mrOrders.size();
    let totalOrderValue = mrOrders.foldLeft(0, func(acc : Nat, o : Types.ChemistOrder) : Nat { acc + o.totalValue });

    {
      mrId;
      month;
      totalCalls;
      uniqueDoctors;
      totalOrders;
      totalOrderValue;
    };
  };

  public func getTerritoryCoverage(
    doctors   : List.List<Types.Doctor>,
    reports   : List.List<Types.CallReport>,
    territory : Text,
    month     : Text,
  ) : Types.TerritoryCoverage {
    let territoryDoctors = doctors.filter(func(d : Types.Doctor) : Bool {
      d.isActive and d.territory == territory
    });
    let totalDoctors = territoryDoctors.size();

    // Collect doctor IDs in this territory
    let territoryDoctorSet = Set.empty<Types.DoctorId>();
    territoryDoctors.forEach(func(d : Types.Doctor) {
      territoryDoctorSet.add(d.id);
    });

    // Collect visited doctor IDs this month in territory
    let visitedSet = Set.empty<Types.DoctorId>();
    reports.forEach(func(r : Types.CallReport) {
      if (r.date.size() >= 7 and r.date.startsWith(#text month)) {
        for (v in r.doctorsVisited.values()) {
          if (territoryDoctorSet.contains(v.doctorId)) {
            visitedSet.add(v.doctorId);
          };
        };
      };
    });

    {
      territory;
      totalDoctors;
      visitedThisMonth = visitedSet.size();
    };
  };

  public func listAllMrSummaries(
    reports : List.List<Types.CallReport>,
    orders  : List.List<Types.ChemistOrder>,
    month   : Text,
  ) : [Types.MrMonthlySummary] {
    // Collect distinct MR IDs that have reports this month
    let mrSet = Set.empty<Types.UserId>();
    reports.forEach(func(r : Types.CallReport) {
      if (r.date.size() >= 7 and r.date.startsWith(#text month)) {
        mrSet.add(r.mrId);
      };
    });
    // Also include MRs with orders this month
    orders.forEach(func(o : Types.ChemistOrder) {
      if (o.date.size() >= 7 and o.date.startsWith(#text month)) {
        mrSet.add(o.mrId);
      };
    });

    mrSet.toArray()
         .map<Types.UserId, Types.MrMonthlySummary>(func(mrId) {
           getMrMonthlySummary(reports, orders, mrId, month)
         });
  };

  // ── MR Call Details (P3) ──────────────────────────────────────────────────

  /// Convert a timestamp in nanoseconds to an ISO date string "YYYY-MM-DD".
  func timestampToDate(ts : Int) : Text {
    // Seconds since epoch
    let secs = ts / 1_000_000_000;
    // Days since epoch (1970-01-01)
    let days = secs / 86400;
    // Approximate year (using 365.2425-day average year)
    var year : Int = 1970;
    var remaining : Int = days;
    label yearLoop loop {
      let daysInYear : Int = if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 366 else 365;
      if (remaining < daysInYear) break yearLoop;
      remaining -= daysInYear;
      year += 1;
    };
    let daysInMonths : [Int] = [
      31, if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 29 else 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];
    var month : Int = 1;
    label monthLoop loop {
      if (month > 12) break monthLoop;
      let dim = daysInMonths[month.toNat() - 1];
      if (remaining < dim) break monthLoop;
      remaining -= dim;
      month += 1;
    };
    let day = remaining + 1;
    let pad2 = func(n : Int) : Text {
      let t = n.toText();
      if (t.size() < 2) "0" # t else t
    };
    year.toText() # "-" # pad2(month) # "-" # pad2(day)
  };

  /// Check if an ISO date string "YYYY-MM-DD" falls within [fromTs, toTs] nanosecond timestamps.
  func dateInRange(date : Text, fromTs : Int, toTs : Int) : Bool {
    let fromDate = timestampToDate(fromTs);
    let toDate   = timestampToDate(toTs);
    date >= fromDate and date <= toDate
  };

  /// Get date-wise call details for an MR within a date range.
  public func getMRCallDetails(
    reports  : List.List<Types.CallReport>,
    doctors  : List.List<Types.Doctor>,
    products : List.List<Types.Product>,
    mrId     : Types.UserId,
    fromTs   : Int,
    toTs     : Int,
  ) : [Types.DayCallSummary] {
    // Filter to reports for this MR within date range
    let fromDate = timestampToDate(fromTs);
    let toDate   = timestampToDate(toTs);
    let filtered = reports.filter(func(r : Types.CallReport) : Bool {
      r.mrId == mrId and r.date >= fromDate and r.date <= toDate
    });

    // Sort ascending by date
    let sorted = filtered.sort(func(a : Types.CallReport, b : Types.CallReport) : { #less; #equal; #greater } {
      if (a.date < b.date) #less
      else if (a.date > b.date) #greater
      else #equal
    });

    // Build a summary per report (one report = one day's entry)
    sorted.toArray().map<Types.CallReport, Types.DayCallSummary>(func(r) {
      // Collect doctor names
      let doctorNames = r.doctorsVisited.map(func(v) {
        switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == v.doctorId })) {
          case (?d) d.name;
          case null "Doctor #" # v.doctorId.toText();
        }
      });

      // Collect unique product names discussed
      let productSet = Set.empty<Text>();
      for (v in r.doctorsVisited.values()) {
        for (pid in v.productIds.values()) {
          switch (products.find(func(p : Types.Product) : Bool { p.id == pid })) {
            case (?p) productSet.add(p.name);
            case null {};
          };
        };
      };
      let productsDiscussed = productSet.toArray();

      // Aggregate samples given
      let samplesMap = Map.empty<Nat, Nat>();
      for (s in r.samplesDistributed.values()) {
        switch (samplesMap.get(s.productId)) {
          case (?existing) samplesMap.add(s.productId, existing + s.quantity);
          case null samplesMap.add(s.productId, s.quantity);
        };
      };
      let samplesGiven = samplesMap.entries().toArray().map(func((pid, qty)) {
        let name = switch (products.find(func(p : Types.Product) : Bool { p.id == pid })) {
          case (?p) p.name;
          case null "Product #" # pid.toText();
        };
        { productName = name; quantity = qty }
      });

      // Aggregate gift articles given
      let giftsMap = Map.empty<Text, Nat>();
      for (v in r.doctorsVisited.values()) {
        for (g in v.giftArticles.values()) {
          switch (giftsMap.get(g.giftArticleName)) {
            case (?existing) giftsMap.add(g.giftArticleName, existing + g.quantity);
            case null giftsMap.add(g.giftArticleName, g.quantity);
          };
        };
      };
      let giftsGiven = giftsMap.entries().toArray().map(func((name, qty)) {
        { itemName = name; quantity = qty }
      });

      // Working mode text
      let workingModeText = switch (r.workingMode) {
        case null "Solo";
        case (?#WorkingAlone) "Solo";
        case (?#WorkingWith) switch (r.workingWithUserName) {
          case (?name) "With " # name;
          case null "With Manager";
        };
      };

      {
        date             = r.date;
        doctorCount      = r.doctorsVisited.size();
        doctorNames;
        productsDiscussed;
        samplesGiven;
        giftsGiven;
        station          = switch (r.workingStation) { case (?s) s; case null r.stationType };
        workingMode      = workingModeText;
      }
    });
  };

  /// Get summary totals for an MR over a date range.
  public func getMRCallSummary(
    reports : List.List<Types.CallReport>,
    mrId    : Types.UserId,
    fromTs  : Int,
    toTs    : Int,
  ) : Types.MRCallSummary {
    let fromDate = timestampToDate(fromTs);
    let toDate   = timestampToDate(toTs);
    let filtered = reports.filter(func(r : Types.CallReport) : Bool {
      r.mrId == mrId and r.date >= fromDate and r.date <= toDate
    });
    let totalDaysWorked   = filtered.size();
    let totalDoctorVisits = filtered.foldLeft(0, func(acc : Nat, r : Types.CallReport) : Nat {
      acc + r.doctorsVisited.size()
    });
    let totalSamplesGiven = filtered.foldLeft(0, func(acc : Nat, r : Types.CallReport) : Nat {
      acc + r.samplesDistributed.foldLeft(0, func(a : Nat, s : Types.SampleDistributed) : Nat {
        a + s.quantity
      })
    });
    { totalDaysWorked; totalDoctorVisits; totalSamplesGiven }
  };

  // ── Missed Doctor Visits (P4) ─────────────────────────────────────────────

  /// Count how many times each allotted doctor was visited in a given month/year.
  /// Returns doctors visited fewer than 2 times (missed visits).
  public func getMissedDoctorsForMR(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    doctors     : List.List<Types.Doctor>,
    mrId        : Types.UserId,
    month       : Nat,
    year        : Nat,
  ) : [Types.MissedDoctorInfo] {
    // Get all doctors allotted to this MR
    let allotted = List.empty<Types.DoctorId>();
    for ((_, v) in assignments.entries()) {
      if (v.mrId == mrId) { allotted.add(v.doctorId) };
    };

    // Count visits per doctor in the given month/year (unique per day)
    // visitDays: doctorId -> Set of date strings
    let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
    for (r in reports.values()) {
      if (r.mrId == mrId and dateMonthFromDate(r.date) == month and dateYearFromDate(r.date) == year) {
        for (v in r.doctorsVisited.values()) {
          switch (visitDays.get(v.doctorId)) {
            case (?daySet) daySet.add(r.date);
            case null {
              let s = Set.empty<Text>();
              s.add(r.date);
              visitDays.add(v.doctorId, s);
            };
          };
        };
      };
    };

    // Build missed list
    let result = List.empty<Types.MissedDoctorInfo>();
    for (did in allotted.values()) {
      let visitCount = switch (visitDays.get(did)) {
        case (?s) s.size();
        case null 0;
      };
      if (visitCount < 2) {
        let doctorName = switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == did })) {
          case (?d) d.name;
          case null "Doctor #" # did.toText();
        };
        result.add({ doctorId = did; doctorName; visitCount });
      };
    };
    result.toArray()
  };

  /// Get missed visit summary for all MRs under a manager.
  /// mrIds: list of MR user IDs to summarize (pre-filtered by caller based on role).
  public func getMRMissedVisitSummaries(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    doctors     : List.List<Types.Doctor>,
    users       : Map.Map<Types.UserId, Text>, // userId -> name mapping
    mrIds       : [Types.UserId],
    month       : Nat,
    year        : Nat,
  ) : [Types.MRMissedSummary] {
    mrIds.map<Types.UserId, Types.MRMissedSummary>(func(mrId) {
      // Get allotted doctors for this MR
      let allotted = List.empty<Types.DoctorId>();
      for ((_, v) in assignments.entries()) {
        if (v.mrId == mrId) { allotted.add(v.doctorId) };
      };
      let totalAllotted = allotted.size();

      // Count unique visits per doctor in the month
      let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
      for (r in reports.values()) {
        if (r.mrId == mrId and dateMonthFromDate(r.date) == month and dateYearFromDate(r.date) == year) {
          for (v in r.doctorsVisited.values()) {
            switch (visitDays.get(v.doctorId)) {
              case (?daySet) daySet.add(r.date);
              case null {
                let s = Set.empty<Text>();
                s.add(r.date);
                visitDays.add(v.doctorId, s);
              };
            };
          };
        };
      };

      var visited2Plus = 0;
      var visited0     = 0;
      var visited1     = 0;
      for (did in allotted.values()) {
        let cnt = switch (visitDays.get(did)) {
          case (?s) s.size();
          case null 0;
        };
        if (cnt == 0)      visited0     += 1
        else if (cnt == 1) visited1     += 1
        else               visited2Plus += 1;
      };

      let mrName = switch (users.get(mrId)) {
        case (?n) n;
        case null "MR #" # mrId.toText();
      };

      {
        mrId;
        mrName;
        totalAllotted;
        visited2Plus;
        visited0;
        visited1;
        totalMissed = visited0 + visited1;
      }
    })
  };

  // ── MR Portal Tagged Entries (P5) ─────────────────────────────────────────

  /// Get call report entries that were submitted via the MR Portal
  /// (submittedViaMRCharge = true) within a date range.
  public func getMRPortalEntries(
    reports  : List.List<Types.CallReport>,
    users    : Map.Map<Types.UserId, Text>, // userId -> name
    fromTs   : Int,
    toTs     : Int,
  ) : [Types.TaggedCallEntry] {
    let fromDate = timestampToDate(fromTs);
    let toDate   = timestampToDate(toTs);
    let result = List.empty<Types.TaggedCallEntry>();
    for (r in reports.values()) {
      if (r.date >= fromDate and r.date <= toDate) {
        // Check if any doctor visit in this report was submitted via MR charge
        let hasMRPortalEntry = r.doctorsVisited.any(func(v : Types.DoctorVisitEntry) : Bool {
          switch (v.submittedViaMRCharge) {
            case (?true) true;
            case _ false;
          }
        });
        if (hasMRPortalEntry) {
          let employeeName = switch (users.get(r.mrId)) {
            case (?n) n;
            case null "Employee #" # r.mrId.toText();
          };
          // Find the primary role from any tagged visit entry
          let primaryRole = switch (r.doctorsVisited.find(func(v : Types.DoctorVisitEntry) : Bool {
            switch (v.submittedByRole) { case (?_) true; case null false }
          })) {
            case (?v) switch (v.submittedByRole) { case (?role) role; case null "Unknown" };
            case null "Unknown";
          };
          result.add({
            employeeId         = r.mrId;
            employeeName;
            primaryRole;
            date               = r.date;
            doctorsVisited     = r.doctorsVisited;
            samplesDistributed = r.samplesDistributed;
          });
        };
      };
    };
    result.toArray()
  };

  // ── Bulk import ───────────────────────────────────────────────────────────

  /// Case-insensitive, whitespace-trimmed area name comparison helper.
  func areaMatches(a : Text, b : Text) : Bool {
    a.trim(#predicate(func c = c == ' ')).toLower() ==
    b.trim(#predicate(func c = c == ' ')).toLower()
  };

  /// Map a free-text qualification string (from Excel) to the correct DoctorQualification variant.
  /// Matching is case-insensitive and whitespace-trimmed.
  /// Multi-word qualifications (e.g. "mbbs dgo") are checked before single-word ones.
  public func mapQualificationText(q : Text) : Types.DoctorQualification {
    let lower = q.trim(#predicate(func c = c == ' ')).toLower();
    if      (lower == "mbbs dgo"   or lower == "mbbsdgo")   { #MBBSdgo   }
    else if (lower == "mbbs dnb"   or lower == "mbbsdnb")   { #MBBSdnb   }
    else if (lower == "mbbs md"    or lower == "mbbsmd")    { #MBBSmd    }
    else if (lower == "mbbs ms"    or lower == "mbbsms")    { #MBBSms    }
    else if (lower == "mbbs ent"   or lower == "mbbsent")   { #MBBSent   }
    else if (lower == "mbbs ortho" or lower == "mbbsortho") { #MBBSortho }
    else if (lower == "mbbs")    { #MBBS   }
    else if (lower == "md")      { #MD     }
    else if (lower == "ms")      { #MS     }
    else if (lower == "bds")     { #BDS    }
    else if (lower == "mds")     { #MDS    }
    else if (lower == "bams")    { #BAMS   }
    else if (lower == "bhms")    { #BHMS   }
    else if (lower == "dnb")     { #DNB    }
    else if (lower == "dm")      { #DM     }
    else if (lower == "mch" or lower == "m.ch") { #MCh }
    else { #Other(q) }
  };

  /// Bulk-create doctors reading area from each Excel row.
  /// areaNames: the full list of valid area names (for per-row validation).
  /// Returns extended result with (doctorId, area) pairs for caller to auto-allot.
  public func bulkImportDoctors(
    doctors       : List.List<Types.Doctor>,
    nextId        : { var val : Nat },
    items         : [Types.BulkImportDoctorInput],
    validAreas    : [Text],  // valid area names from the system
    createdByMrId : Types.UserId,
    now           : Types.Timestamp,
  ) : Types.BulkImportDoctorResult {
    var succeeded : Nat = 0;
    var failed    : Nat = 0;
    let errors    = List.empty<Text>();
    let newDoctorIds = List.empty<(Types.DoctorId, Text)>();

    for (item in items.values()) {
      if (item.name == "") {
        failed += 1;
        errors.add("Row with empty name skipped");
      } else if (item.area == "") {
        failed += 1;
        errors.add("Row '" # item.name # "': Area/Territory is required");
      } else {
        // Validate area against known areas (case-insensitive)
        let matchedArea = switch (validAreas.find(func(a : Text) : Bool { areaMatches(a, item.area) })) {
          case (?found) found;
          case null "";
        };
        if (matchedArea == "") {
          failed += 1;
          errors.add("Row '" # item.name # "': Area not found: " # item.area);
        } else {
          // Check for duplicate (same name + area, case-insensitive)
          let isDuplicate = doctors.any(func(d : Types.Doctor) : Bool {
            d.isActive and
            d.name.toLower() == item.name.toLower() and
            areaMatches(d.area, matchedArea)
          });
          if (isDuplicate) {
            failed += 1;
            errors.add("Row '" # item.name # "' in area '" # matchedArea # "': Duplicate entry");
          } else {
            let id = nextId.val;
            nextId.val += 1;
            let doctor : Types.Doctor = {
              id;
              var name           = item.name;
              var qualification  = mapQualificationText(item.qualification);
              var station        = item.station;
              var area           = matchedArea;  // use canonical area name from system
              var territory      = matchedArea;
              var specialization = item.specialization;
              var contactPhone   = item.contactPhone;
              var isActive       = true;
              var category       = "";
              var email          = "";
              var clinicName     = "";
              var address        = "";
              var isCoreDoctor   = false;
              var visitFrequencyTarget = 0;
              createdBy          = createdByMrId;
              createdAt          = now;
            };
            doctors.add(doctor);
            newDoctorIds.add((id, matchedArea));
            succeeded += 1;
          };
        };
      };
    };

    {
      succeeded;
      failed;
      errors       = errors.toArray();
      newDoctorIds = newDoctorIds.toArray();
    };
  };

  /// Bulk-create chemists for a given area.
  /// createdByMrId: the MR (or admin=0) who triggered the import.
  public func bulkImportChemists(
    chemists      : List.List<Types.Chemist>,
    nextId        : { var val : Nat },
    items         : [Types.BulkImportChemistInput],
    areaName      : Text,
    createdByMrId : Types.UserId,
    now           : Types.Timestamp,
  ) : Types.BulkImportResult {
    var succeeded : Nat = 0;
    var failed    : Nat = 0;
    let errors    = List.empty<Text>();

    for (item in items.values()) {
      if (item.name == "") {
        failed += 1;
        errors.add("Row with empty name skipped");
      } else {
        let id = nextId.val;
        nextId.val += 1;
        let chemist : Types.Chemist = {
          id;
          var name         = item.name;
          var shopName     = item.shopName;
          var address      = item.address;
          var area         = areaName;
          var territory    = areaName;
          var contactPhone = item.contactPhone;
          var isActive     = true;
          createdBy        = createdByMrId;
          createdAt        = now;
        };
        chemists.add(chemist);
        succeeded += 1;
      };
    };

    {
      succeeded;
      failed;
      errors = errors.toArray();
    };
  };

  // ── Missed Visit Alerts (20-day threshold) ────────────────────────────────

  /// Nanoseconds per day constant
  let nanosecondsPerDay : Int = 86_400_000_000_000;

  /// Get last visit date (as ns timestamp) for a doctor by a specific MR.
  /// Returns 0 if the doctor was never visited.
  func lastVisitTimestamp(
    reports  : List.List<Types.CallReport>,
    mrId     : Types.UserId,
    doctorId : Types.DoctorId,
  ) : Int {
    var latest : Int = 0;
    for (r in reports.values()) {
      if (r.mrId == mrId) {
        let visited = r.doctorsVisited.any(func(v : Types.DoctorVisitEntry) : Bool {
          v.doctorId == doctorId
        });
        if (visited) {
          // Use createdAt (ns timestamp) as the visit timestamp
          if (r.createdAt > latest) latest := r.createdAt;
        };
      };
    };
    latest
  };

  /// Returns true if the given dismissed alert covers this mrId+doctorId on the same calendar day.
  func isAlertDismissedForDay(
    dismissed : List.List<Types.DismissedAlert>,
    byUserId  : Types.UserId,
    mrId      : Types.UserId,
    doctorId  : Types.DoctorId,
    now       : Int,
  ) : Bool {
    let todayStart = (now / nanosecondsPerDay) * nanosecondsPerDay;
    let todayEnd   = todayStart + nanosecondsPerDay;
    dismissed.any(func(d : Types.DismissedAlert) : Bool {
      d.dismissedBy == byUserId and
      d.mrId == mrId and
      d.doctorId == doctorId and
      d.dismissedDate >= todayStart and
      d.dismissedDate < todayEnd
    })
  };

  /// Get missed visit alerts for all MRs under a given manager.
  /// Threshold: 20 days since last visit (or never visited = 999 days).
  /// Returns alerts ordered by daysSinceLastVisit descending.
  public func getMissedVisitAlertsForManager(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    doctors     : List.List<Types.Doctor>,
    users       : Map.Map<Types.UserId, Text>,  // userId -> name
    dismissed   : List.List<Types.DismissedAlert>,
    managerId   : Types.UserId,
    mrIds       : [Types.UserId],   // pre-filtered by caller
    now         : Int,
  ) : [Types.MissedVisitAlert] {
    let result = List.empty<Types.MissedVisitAlert>();
    let thresholdNs : Int = 20 * nanosecondsPerDay;

    for (mrId in mrIds.values()) {
      let mrName = switch (users.get(mrId)) {
        case (?n) n;
        case null "MR #" # mrId.toText();
      };
      // Allotted doctors for this MR
      for ((_, assign) in assignments.entries()) {
        if (assign.mrId == mrId) {
          let doctorId = assign.doctorId;
          let lastVisit = lastVisitTimestamp(reports, mrId, doctorId);
          let daysSince : Int = if (lastVisit == 0) {
            999  // never visited
          } else {
            (now - lastVisit) / nanosecondsPerDay
          };
          if (daysSince >= 20 and not isAlertDismissedForDay(dismissed, managerId, mrId, doctorId, now)) {
            let doctorName = switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
              case (?d) d.name;
              case null "Doctor #" # doctorId.toText();
            };
            let area = switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
              case (?d) d.area;
              case null "";
            };
            result.add({
              mrId;
              mrName;
              doctorId;
              doctorName;
              lastVisitDate      = lastVisit;
              daysSinceLastVisit = daysSince;
              area;
            });
          };
        };
      };
    };

    // Sort descending by daysSinceLastVisit (most overdue first)
    result.sortInPlace(func(a : Types.MissedVisitAlert, b : Types.MissedVisitAlert) : { #less; #equal; #greater } {
      if (b.daysSinceLastVisit > a.daysSinceLastVisit) #less
      else if (b.daysSinceLastVisit < a.daysSinceLastVisit) #greater
      else #equal
    });
    result.toArray()
  };

  /// Record a dismissed alert.
  public func dismissAlert(
    dismissed : List.List<Types.DismissedAlert>,
    byUserId  : Types.UserId,
    mrId      : Types.UserId,
    doctorId  : Types.DoctorId,
    now       : Int,
  ) : () {
    dismissed.add({
      dismissedBy   = byUserId;
      mrId;
      doctorId;
      dismissedDate = now;
    });
  };

  // ── Doctor Visit Trend ────────────────────────────────────────────────────

  /// Compute monthYear strings for the last N complete months relative to now.
  /// Returns in ascending chronological order.
  func lastNMonthYears(now : Int, n : Nat) : [Text] {
    // Get current month from now
    let nowSecs = now / 1_000_000_000;
    let nowDays = nowSecs / 86400;
    // Approximate current year + month
    var year : Int = 1970;
    var remaining : Int = nowDays;
    label yearLoop loop {
      let daysInYear : Int = if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 366 else 365;
      if (remaining < daysInYear) break yearLoop;
      remaining -= daysInYear;
      year += 1;
    };
    let daysInMonths : [Int] = [
      31, if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 29 else 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];
    var month : Int = 1;
    label monthLoop loop {
      if (month > 12) break monthLoop;
      let dim = daysInMonths[month.toNat() - 1];
      if (remaining < dim) break monthLoop;
      remaining -= dim;
      month += 1;
    };

    // Build last N month strings starting from (current month - n) going to (current month - 1)
    let result = List.empty<Text>();
    var m = month - 1;  // current month (1-based); go back from here
    var y = year;
    // We want n complete months going backwards
    var i = 0;
    let months = List.empty<(Int, Int)>(); // (year, month) pairs in reverse
    label loop2 loop {
      if (i >= n) break loop2;
      if (m < 1) { m := 12; y -= 1 };
      months.add((y, m));
      m -= 1;
      i += 1;
    };
    // Reverse to get ascending order
    let arr = months.toArray().reverse();
    let pad2 = func(n2 : Int) : Text {
      let t = n2.toText();
      if (t.size() < 2) "0" # t else t
    };
    arr.map(func((yr, mo) : (Int, Int)) : Text {
      yr.toText() # "-" # pad2(mo)
    })
  };

  /// For an MR and a given monthYear ("YYYY-MM"), count doctors visited >= 2 times.
  func visitPercentageForMonth(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    mrId        : Types.UserId,
    monthYear   : Text,
  ) : (Float, Nat, Nat) {  // (percentage, visited, total)
    // Total allotted doctors
    let allotted = Set.empty<Types.DoctorId>();
    for ((_, v) in assignments.entries()) {
      if (v.mrId == mrId) allotted.add(v.doctorId);
    };
    let total = allotted.size();
    if (total == 0) return (0.0, 0, 0);

    // Count visits per doctor in the month
    let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
    for (r in reports.values()) {
      if (r.mrId == mrId and r.date.size() >= 7 and r.date.startsWith(#text monthYear)) {
        for (v in r.doctorsVisited.values()) {
          switch (visitDays.get(v.doctorId)) {
            case (?daySet) daySet.add(r.date);
            case null {
              let s = Set.empty<Text>();
              s.add(r.date);
              visitDays.add(v.doctorId, s);
            };
          };
        };
      };
    };

    var visited2Plus = 0;
    for (did in allotted.values()) {
      let cnt = switch (visitDays.get(did)) {
        case (?s) s.size();
        case null 0;
      };
      if (cnt >= 2) visited2Plus += 1;
    };

    let pct : Float = visited2Plus.toFloat() / total.toFloat() * 100.0;
    (pct, visited2Plus, total)
  };

  /// Get per-MR visit percentage trend for the last N months.
  public func getDoctorVisitTrend(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    users       : Map.Map<Types.UserId, Text>,
    mrIds       : [Types.UserId],
    months      : Nat,
    now         : Int,
  ) : [Types.MonthlyVisitData] {
    let monthList = lastNMonthYears(now, months);
    let result = List.empty<Types.MonthlyVisitData>();
    for (monthYear in monthList.values()) {
      for (mrId in mrIds.values()) {
        let mrName = switch (users.get(mrId)) {
          case (?n) n;
          case null "MR #" # mrId.toText();
        };
        let (pct, visited, total) = visitPercentageForMonth(reports, assignments, mrId, monthYear);
        result.add({
          monthYear;
          mrId;
          mrName;
          visitPercentage = pct;
          doctorsVisited  = visited;
          totalDoctors    = total;
        });
      };
    };
    result.toArray()
  };

  /// Get consolidated team average visit percentage per month.
  public func getConsolidatedVisitTrend(
    reports     : List.List<Types.CallReport>,
    assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
    mrIds       : [Types.UserId],
    months      : Nat,
    now         : Int,
  ) : [Types.ConsolidatedMonthData] {
    let monthList = lastNMonthYears(now, months);
    let result = List.empty<Types.ConsolidatedMonthData>();
    for (monthYear in monthList.values()) {
      let totalMRs = mrIds.size();
      if (totalMRs == 0) {
        result.add({ monthYear; avgVisitPercentage = 0.0; totalMRs = 0 });
      } else {
        var sumPct : Float = 0.0;
        for (mrId in mrIds.values()) {
          let (pct, _, _) = visitPercentageForMonth(reports, assignments, mrId, monthYear);
          sumPct += pct;
        };
        result.add({
          monthYear;
          avgVisitPercentage = sumPct / totalMRs.toFloat();
          totalMRs;
        });
      };
    };
    result.toArray()
  };

  // ── Missed visits (HQ+Area based, no allotment table) ────────────────────

  /// Count visits for doctors from a pre-resolved doctor list, return those visited < 2 times.
  public func getMissedDoctorsFromList(
    reports    : List.List<Types.CallReport>,
    mrDoctors  : [Types.DoctorInfo],
    mrId       : Types.UserId,
    month      : Nat,
    year       : Nat,
  ) : [Types.MissedDoctorInfo] {
    let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
    for (r in reports.values()) {
      if (r.mrId == mrId and dateMonthFromDate(r.date) == month and dateYearFromDate(r.date) == year) {
        for (v in r.doctorsVisited.values()) {
          switch (visitDays.get(v.doctorId)) {
            case (?daySet) daySet.add(r.date);
            case null {
              let s = Set.empty<Text>();
              s.add(r.date);
              visitDays.add(v.doctorId, s);
            };
          };
        };
      };
    };
    let result = List.empty<Types.MissedDoctorInfo>();
    for (d in mrDoctors.values()) {
      let visitCount = switch (visitDays.get(d.id)) {
        case (?s) s.size();
        case null 0;
      };
      if (visitCount < 2) {
        result.add({ doctorId = d.id; doctorName = d.name; visitCount });
      };
    };
    result.toArray()
  };

  /// Get missed visit summary for all MRs using HQ+Area matching.
  public func getMRMissedVisitSummariesHQArea(
    reports          : List.List<Types.CallReport>,
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    nameMap          : Map.Map<Types.UserId, Text>,
    mrIds            : [Types.UserId],
    month            : Nat,
    year             : Nat,
    now              : Int,
  ) : [Types.MRMissedSummary] {
    mrIds.map<Types.UserId, Types.MRMissedSummary>(func(mrId) {
      let mrDoctors = getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrId, now);
      let totalAllotted = mrDoctors.size();

      let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
      for (r in reports.values()) {
        if (r.mrId == mrId and dateMonthFromDate(r.date) == month and dateYearFromDate(r.date) == year) {
          for (v in r.doctorsVisited.values()) {
            switch (visitDays.get(v.doctorId)) {
              case (?daySet) daySet.add(r.date);
              case null {
                let s = Set.empty<Text>();
                s.add(r.date);
                visitDays.add(v.doctorId, s);
              };
            };
          };
        };
      };

      var visited2Plus = 0;
      var visited0     = 0;
      var visited1     = 0;
      for (d in mrDoctors.values()) {
        let cnt = switch (visitDays.get(d.id)) {
          case (?s) s.size();
          case null 0;
        };
        if (cnt == 0)      visited0     += 1
        else if (cnt == 1) visited1     += 1
        else               visited2Plus += 1;
      };

      let mrName = switch (nameMap.get(mrId)) {
        case (?n) n;
        case null "MR #" # mrId.toText();
      };

      {
        mrId;
        mrName;
        totalAllotted;
        visited2Plus;
        visited0;
        visited1;
        totalMissed = visited0 + visited1;
      }
    })
  };

  /// Get last visit timestamp for a doctor by an MR (reused helper).
  func lastVisitTimestampLocal(
    reports  : List.List<Types.CallReport>,
    mrId     : Types.UserId,
    doctorId : Types.DoctorId,
  ) : Int {
    var latest : Int = 0;
    for (r in reports.values()) {
      if (r.mrId == mrId) {
        let visited = r.doctorsVisited.any(func(v : Types.DoctorVisitEntry) : Bool {
          v.doctorId == doctorId
        });
        if (visited and r.createdAt > latest) latest := r.createdAt;
      };
    };
     latest
   };

   func isAlertDismissedLocal(
    dismissed : List.List<Types.DismissedAlert>,
    byUserId  : Types.UserId,
    mrId      : Types.UserId,
    doctorId  : Types.DoctorId,
    now       : Int,
  ) : Bool {
    let todayStart = (now / nanosecondsPerDay) * nanosecondsPerDay;
    let todayEnd   = todayStart + nanosecondsPerDay;
    dismissed.any(func(d : Types.DismissedAlert) : Bool {
      d.dismissedBy == byUserId and
      d.mrId == mrId and
      d.doctorId == doctorId and
      d.dismissedDate >= todayStart and
      d.dismissedDate < todayEnd
    })
  };

  /// Get missed visit alerts using HQ+Area matching instead of allotment table.
  public func getMissedVisitAlertsHQArea(
    reports          : List.List<Types.CallReport>,
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    nameMap          : Map.Map<Types.UserId, Text>,
    dismissed        : List.List<Types.DismissedAlert>,
    managerId        : Types.UserId,
    mrIds            : [Types.UserId],
    now              : Int,
  ) : [Types.MissedVisitAlert] {
    let result = List.empty<Types.MissedVisitAlert>();
    let thresholdNs : Int = 20 * nanosecondsPerDay;

    for (mrId in mrIds.values()) {
      let mrName = switch (nameMap.get(mrId)) {
        case (?n) n;
        case null "MR #" # mrId.toText();
      };
      let mrDoctors = getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrId, now);
      for (d in mrDoctors.values()) {
        let lastVisit = lastVisitTimestampLocal(reports, mrId, d.id);
        let daysSince : Int = if (lastVisit == 0) {
          999
        } else {
          (now - lastVisit) / nanosecondsPerDay
        };
        if (daysSince >= 20 and not isAlertDismissedLocal(dismissed, managerId, mrId, d.id, now)) {
          result.add({
            mrId;
            mrName;
            doctorId         = d.id;
            doctorName       = d.name;
            lastVisitDate    = lastVisit;
            daysSinceLastVisit = daysSince;
            area             = d.area;
          });
        };
      };
    };

    result.sortInPlace(func(a : Types.MissedVisitAlert, b : Types.MissedVisitAlert) : { #less; #equal; #greater } {
      if (b.daysSinceLastVisit > a.daysSinceLastVisit) #less
      else if (b.daysSinceLastVisit < a.daysSinceLastVisit) #greater
      else #equal
    });
    result.toArray()
  };

  // ── Doctor Visit Trend (HQ+Area based) ────────────────────────────────────

  func visitPercentageForMonthHQArea(
    reports          : List.List<Types.CallReport>,
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrId             : Types.UserId,
    monthYear        : Text,
    now              : Int,
  ) : (Float, Nat, Nat) {
    let mrDoctors = getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrId, now);
    let total = mrDoctors.size();
    if (total == 0) return (0.0, 0, 0);

    let visitDays = Map.empty<Types.DoctorId, Set.Set<Text>>();
    for (r in reports.values()) {
      if (r.mrId == mrId and r.date.size() >= 7 and r.date.startsWith(#text monthYear)) {
        for (v in r.doctorsVisited.values()) {
          switch (visitDays.get(v.doctorId)) {
            case (?daySet) daySet.add(r.date);
            case null {
              let s = Set.empty<Text>();
              s.add(r.date);
              visitDays.add(v.doctorId, s);
            };
          };
        };
      };
    };

    var visited2Plus = 0;
    for (d in mrDoctors.values()) {
      let cnt = switch (visitDays.get(d.id)) {
        case (?s) s.size();
        case null 0;
      };
      if (cnt >= 2) visited2Plus += 1;
    };

    let pct : Float = visited2Plus.toFloat() / total.toFloat() * 100.0;
    (pct, visited2Plus, total)
  };

  /// Get per-MR visit percentage trend using HQ+Area matching.
  public func getDoctorVisitTrendHQArea(
    reports          : List.List<Types.CallReport>,
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    nameMap          : Map.Map<Types.UserId, Text>,
    mrIds            : [Types.UserId],
    months           : Nat,
    now              : Int,
  ) : [Types.MonthlyVisitData] {
    let monthList = lastNMonthYears(now, months);
    let result = List.empty<Types.MonthlyVisitData>();
    for (monthYear in monthList.values()) {
      for (mrId in mrIds.values()) {
        let mrName = switch (nameMap.get(mrId)) {
          case (?n) n;
          case null "MR #" # mrId.toText();
        };
        let (pct, visited, total) = visitPercentageForMonthHQArea(reports, doctors, users, areas, hqs, additionalCharges, mrId, monthYear, now);
        result.add({
          monthYear;
          mrId;
          mrName;
          visitPercentage = pct;
          doctorsVisited  = visited;
          totalDoctors    = total;
        });
      };
    };
    result.toArray()
  };

  /// Get consolidated team average visit percentage using HQ+Area matching.
  public func getConsolidatedVisitTrendHQArea(
    reports          : List.List<Types.CallReport>,
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrIds            : [Types.UserId],
    months           : Nat,
    now              : Int,
  ) : [Types.ConsolidatedMonthData] {
    let monthList = lastNMonthYears(now, months);
    let result = List.empty<Types.ConsolidatedMonthData>();
    for (monthYear in monthList.values()) {
      let totalMRs = mrIds.size();
      if (totalMRs == 0) {
        result.add({ monthYear; avgVisitPercentage = 0.0; totalMRs = 0 });
      } else {
        var sumPct : Float = 0.0;
        for (mrId in mrIds.values()) {
          let (pct, _, _) = visitPercentageForMonthHQArea(reports, doctors, users, areas, hqs, additionalCharges, mrId, monthYear, now);
          sumPct += pct;
        };
        result.add({
          monthYear;
          avgVisitPercentage = sumPct / totalMRs.toFloat();
          totalMRs;
        });
      };
    };
    result.toArray()
  };

  /// Permanently delete a doctor: mark isActive=false and log audit.
  public func deleteDoctorById(
    doctors    : List.List<Types.Doctor>,
    auditLogs  : List.List<Types.AllotmentAuditLog>,
    nextLogId  : { var val : Nat },
    doctorId   : Types.DoctorId,
    deletedBy  : Types.UserId,
    now        : Int,
  ) : Bool {
    switch (doctors.find(func(d : Types.Doctor) : Bool { d.id == doctorId })) {
      case null false;
      case (?d) {
        let doctorName = d.name;
        d.isActive := false;
        let lid = nextLogId.val;
        nextLogId.val += 1;
        auditLogs.add({
          logId         = lid;
          actionType    = #Delete;
          performedBy   = deletedBy;
          performedAt   = now;
          doctorId      = ?doctorId;
          doctorDetails = ?doctorName;
          mrId          = null;
          changes       = "Deleted doctor " # doctorName;
        });
        true
      };
    };
  };

  /// Bulk delete doctors. Returns count of deleted and failed.
  public func bulkDeleteDoctors(
    doctors    : List.List<Types.Doctor>,
    auditLogs  : List.List<Types.AllotmentAuditLog>,
    nextLogId  : { var val : Nat },
    doctorIds  : [Types.DoctorId],
    deletedBy  : Types.UserId,
    now        : Int,
  ) : Types.BulkDeleteResult {
    var deleted = 0;
    var failed  = 0;
    for (did in doctorIds.values()) {
      let ok = deleteDoctorById(doctors, auditLogs, nextLogId, did, deletedBy, now);
      if (ok) deleted += 1 else failed += 1;
    };
    { deleted; failed }
  };

  /// Get audit logs filtered by date range and/or action type.
  public func getDoctorAuditLogs(
    auditLogs  : List.List<Types.AllotmentAuditLog>,
    fromDate   : ?Int,
    toDate     : ?Int,
    actionType : ?Text,
  ) : [Types.AllotmentAuditLog] {
    auditLogs.filter(func(l : Types.AllotmentAuditLog) : Bool {
      let afterFrom = switch (fromDate) {
        case (?fd) l.performedAt >= fd;
        case null true;
      };
      let beforeTo = switch (toDate) {
        case (?td) l.performedAt <= td;
        case null true;
      };
      let matchesAction = switch (actionType) {
        case (?at) {
          let actionLabel = switch (l.actionType) {
            case (#Edit)   "Edit";
            case (#Delete) "Delete";
          };
          actionLabel == at
        };
        case null true;
      };
      afterFrom and beforeTo and matchesAction
    }).toArray()
  };

  // ── HQ+Area based doctor lookup (on-the-fly, no allotment table) ──────────

  /// Collect all area names accessible to an MR based on their hqIds+areaIds and
  /// active additional charge areas. Returns (areaId, areaName) pairs.
  /// If migrationDone=true, uses hqAssignments blocks instead of flat fields.
  func collectMRAreaPairs(
    userRecord       : AuthTypes.UserRecord,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    now              : Int,
  ) : [(Nat, Text)] {
    let result = List.empty<(Nat, Text)>();
    let seen   = Set.empty<Nat>();

    if (userRecord.migrationDone and userRecord.hqAssignments.size() > 0) {
      // ── Prefer per-HQ blocks ────────────────────────────────────────────────
      for (block in userRecord.hqAssignments.values()) {
        for (aId in block.areaIds.values()) {
          switch (areas.get(aId)) {
            case (?ar) {
              if (ar.isActive and not seen.contains(aId)) {
                seen.add(aId);
                result.add((aId, ar.name));
              };
            };
            case null {};
          };
        };
      };
    } else {
      // ── Fallback: flat hqIds+areaIds (legacy / pre-migration) ──────────────

      // Primary areas from areaIds
      for (aId in userRecord.areaIds.values()) {
        switch (areas.get(aId)) {
          case (?ar) {
            if (ar.isActive and not seen.contains(aId)) {
              seen.add(aId);
              result.add((aId, ar.name));
            };
          };
          case null {};
        };
      };

      // Areas implied by hqIds — include all active areas under each assigned HQ
      for (hId in userRecord.hqIds.values()) {
        for ((aId, ar) in areas.entries()) {
          if (ar.hqId == hId and ar.isActive and not seen.contains(aId)) {
            seen.add(aId);
            result.add((aId, ar.name));
          };
        };
      };
    };

    // Additional charge areas (currently active) — merged for both paths
    for (charge in additionalCharges.values()) {
      if (charge.employeeId == userRecord.id and charge.effectiveFrom <= now and charge.effectiveTo >= now) {
        switch (charge.chargeType) {
          case (#Area) {
            // New multi-HQ blocks take priority
            if (charge.additionalHqAssignments.size() > 0) {
              for (block in charge.additionalHqAssignments.values()) {
                for (aId in block.areaIds.values()) {
                  switch (areas.get(aId)) {
                    case (?ar) {
                      if (ar.isActive and not seen.contains(aId)) {
                        seen.add(aId);
                        result.add((aId, ar.name));
                      };
                    };
                    case null {};
                  };
                };
              };
            } else {
              // Fallback: old single-area fields
              switch (charge.additionalAreaId) {
                case (?aid) {
                  switch (areas.get(aid)) {
                    case (?ar) {
                      if (ar.isActive and not seen.contains(aid)) {
                        seen.add(aid);
                        result.add((aid, ar.name));
                      };
                    };
                    case null {};
                  };
                };
                case null {
                  // Fallback: text-based area name match when no ID
                  switch (charge.additionalArea) {
                    case (?aName) {
                      if (aName != "") {
                        // Try to resolve to an ID
                        var resolved = false;
                        for ((aId, ar) in areas.entries()) {
                          if (not resolved and areaMatches(ar.name, aName) and ar.isActive and not seen.contains(aId)) {
                            seen.add(aId);
                            result.add((aId, ar.name));
                            resolved := true;
                          };
                        };
                      };
                    };
                    case null {};
                  };
                };
              };
            };
          };
          case _ {};
        };
      };
    };

    result.toArray()
  };

  /// Returns all active doctors whose area name matches any of the MR's accessible areas.
  /// Looks up the MR's hqIds, areaIds, and active additional charges on-the-fly — no allotment table.
  public func getDoctorsByMRHQAndArea(
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrId             : Types.UserId,
    now              : Int,
  ) : [Types.DoctorInfo] {
    let userOpt = users.get(mrId);
    switch (userOpt) {
      case null { [] };
      case (?u) {
        let areaPairs = collectMRAreaPairs(u, areas, hqs, additionalCharges, now);
        if (areaPairs.size() == 0) return [];
        // Build set of lowercase area names for fast matching
        let areaNames = areaPairs.map(func((_, n) : (Nat, Text)) : Text { n.toLower().trim(#predicate(func c = c == ' ')) });
        doctors.filter(func(d : Types.Doctor) : Bool {
          if (not d.isActive) return false;
          let dArea = d.area.toLower().trim(#predicate(func c = c == ' '));
          areaNames.any(func(a : Text) : Bool { a == dArea })
        })
        .map<Types.Doctor, Types.DoctorInfo>(func(d) { doctorToInfo(d, Map.empty<Text, Text>()) })
        .toArray()
      };
    };
  };

  /// Returns active doctors accessible to an MR additionally filtered by station name.
  /// Used by Doctor Call Entry Step 1 to populate the doctor dropdown after station selection.
  public func getDoctorsForStation(
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrId             : Types.UserId,
    stationName      : Text,
    now              : Int,
  ) : [Types.DoctorInfo] {
    let all = getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrId, now);
    let stationLower = stationName.toLower().trim(#predicate(func c = c == ' '));
    all.filter(func(d : Types.DoctorInfo) : Bool {
      d.station.toLower().trim(#predicate(func c = c == ' ')) == stationLower
    })
  };

  // ── Stations for MR (Doctor Call Step 1) ─────────────────────────────────

  /// Get all distinct station values for an MR from all doctors in their accessible areas.
  /// Returns deduplicated, sorted list of non-empty station names.
  public func getStationsByMR(
    doctors          : List.List<Types.Doctor>,
    users            : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    areas            : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs              : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrId             : Types.UserId,
    now              : Int,
  ) : [Text] {
    let all = getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrId, now);
    let stationSet = Set.empty<Text>();
    for (d in all.values()) {
      if (d.station != "") stationSet.add(d.station);
    };
    let arr = stationSet.toArray();
    arr.sort(func(a : Text, b : Text) : { #less; #equal; #greater } { Text.compare(a, b) })
  };

  /// Get stations for an MR by reading directly from the Station Master (predefined stations),
  /// using the MR's hqAssignments blocks (or flat hqIds fallback).
  /// Returns StationRecord[] sorted by stationName — uses the Station Master,
  /// not doctor records, so it works even before any doctors are added.
  public func getStationsByMRHqAssignments(
    users             : Map.Map<Types.UserId, AuthTypes.UserRecord>,
    stations          : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
    additionalCharges : List.List<ACTypes.AdditionalCharge>,
    mrId              : Types.UserId,
    now               : Int,
  ) : [LocTypes.StationRecord] {
    let userOpt = users.get(mrId);
    switch (userOpt) {
      case null { [] };
      case (?u) {
        let seen    = Set.empty<LocTypes.LocationId>();
        let result  = List.empty<LocTypes.StationRecord>();

        // Collect HQ IDs from hqAssignments (preferred) or flat hqIds
        let hqIdSet = Set.empty<LocTypes.LocationId>();
        if (u.migrationDone and u.hqAssignments.size() > 0) {
          for (block in u.hqAssignments.values()) {
            hqIdSet.add(block.hqId);
          };
        } else {
          for (hId in u.hqIds.values()) {
            hqIdSet.add(hId);
          };
        };

        // Add stations from Additional Charge HQ blocks
        for (charge in additionalCharges.values()) {
          if (charge.employeeId == u.id and charge.effectiveFrom <= now and charge.effectiveTo >= now) {
            switch (charge.chargeType) {
              case (#Area) {
                if (charge.additionalHqAssignments.size() > 0) {
                  for (block in charge.additionalHqAssignments.values()) {
                    hqIdSet.add(block.hqId);
                  };
                } else {
                  switch (charge.additionalHqId) {
                    case (?hId) hqIdSet.add(hId);
                    case null {};
                  };
                };
              };
              case _ {};
            };
          };
        };

        // Fetch all active stations whose hqId is in our set
        for ((sid, s) in stations.entries()) {
          if (s.isActive and hqIdSet.contains(s.hqId) and not seen.contains(sid)) {
            seen.add(sid);
            result.add(s);
          };
        };

        // Sort by stationName
        let arr = result.toArray();
        arr.sort(func(a : LocTypes.StationRecord, b : LocTypes.StationRecord) : { #less; #equal; #greater } {
          Text.compare(a.stationName, b.stationName)
        })
      };
    };
  };

  // ── MR grouped by ASM for manager hierarchy reports ───────────────────────

  /// Returns all MRs under a given manager, grouped by their immediate ASM.
  /// Works for RSM (gets ASMs → MRs), ZSM (gets RSMs → ASMs → MRs),
  /// as well as Admin/HR.
  ///
  /// managerId: the userId of the RSM/ZSM/Admin calling the function
  /// transitiveIds: pre-computed BFS result from allReporteeIds(users, managerId)
  ///   — pass [] to let this function compute it internally, but callers that
  ///   already have the list should pass it to avoid a duplicate BFS walk.
  public func getMrsGroupedByAsmForManager(
    users        : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    managerId    : AuthTypes.UserId,
    transitiveIds : [AuthTypes.UserId],  // pass [] to compute internally
  ) : [Types.AsmMrGroup] {
    // Use provided transitiveIds or re-run BFS
    let allIds : [AuthTypes.UserId] = if (transitiveIds.size() > 0) {
      transitiveIds
    } else {
      // BFS inline (same logic as allReporteeIds)
      let visited2 = List.empty<AuthTypes.UserId>();
      let queue2   = List.empty<AuthTypes.UserId>();
      queue2.add(managerId);
      label bfs2 loop {
        switch (queue2.removeLast()) {
          case null    { break bfs2 };
          case (?uid2) {
            if (not visited2.contains(uid2)) {
              visited2.add(uid2);
              for ((_, u2) in users.entries()) {
                switch (u2.reportsTo) {
                  case (?mid2) { if (mid2 == uid2) { queue2.add(u2.id) } };
                  case null    {};
                }
              }
            }
          };
        }
      };
      let res2 = List.empty<AuthTypes.UserId>();
      for (uid2 in visited2.values()) {
        if (uid2 != managerId) res2.add(uid2)
      };
      res2.toArray()
    };

    // Build a Set for O(log n) membership check
    let allIdSet = Set.empty<AuthTypes.UserId>();
    for (id in allIds.values()) { allIdSet.add(id) };

    // Collect ASMs that are in the transitive set
    let asmMap = Map.empty<AuthTypes.UserId, List.List<Types.MrGroupEntry>>();
    for (id in allIds.values()) {
      switch (users.get(id)) {
        case (?u) {
          switch (u.role) {
            case (#MR) {
              // Find the ASM this MR directly reports to (must also be in our scope)
              let asmId : AuthTypes.UserId = switch (u.reportsTo) {
                case (?mid) {
                  // If the direct manager is in scope and is an ASM, use them.
                  // If the direct manager is the managerId themselves (edge case),
                  // group under a virtual ASM = 0 (direct).
                  if (mid == managerId) { 0 }
                  else {
                    switch (users.get(mid)) {
                      case (?mgr) {
                        switch (mgr.role) {
                          case (#ASM) mid;
                          // If direct manager is RSM/ZSM/etc., still group under 0
                          case _ 0;
                        }
                      };
                      case null 0;
                    }
                  }
                };
                case null 0;
              };
              let mrEntry : Types.MrGroupEntry = { mrId = u.id; mrName = u.name };
              switch (asmMap.get(asmId)) {
                case (?lst) lst.add(mrEntry);
                case null {
                  let lst2 = List.empty<Types.MrGroupEntry>();
                  lst2.add(mrEntry);
                  asmMap.add(asmId, lst2);
                };
              };
            };
            case _ {};
          }
        };
        case null {};
      }
    };

    // Build result array of AsmMrGroup
    let result = List.empty<Types.AsmMrGroup>();
    for ((asmId, mrList) in asmMap.entries()) {
      let asmName : Text = if (asmId == 0) {
        "Direct Reports"
      } else {
        switch (users.get(asmId)) {
          case (?u) u.name;
          case null "ASM #" # asmId.toText();
        }
      };
      result.add({
        asmId;
        asmName;
        mrs = mrList.toArray();
      });
    };
    result.toArray()
  };
};
