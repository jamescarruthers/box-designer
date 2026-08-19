export declare class Handle_Poly_Triangulation {
  Nullify(): void;
  IsNull(): boolean;
  reset(thePtr: Poly_Triangulation): void;
  get(): Poly_Triangulation;
  delete(): void;
}

  export declare class Handle_Poly_Triangulation_1 extends Handle_Poly_Triangulation {
    constructor();
  }

  export declare class Handle_Poly_Triangulation_2 extends Handle_Poly_Triangulation {
    constructor(thePtr: Poly_Triangulation);
  }

  export declare class Handle_Poly_Triangulation_3 extends Handle_Poly_Triangulation {
    constructor(theHandle: Handle_Poly_Triangulation);
  }

  export declare class Handle_Poly_Triangulation_4 extends Handle_Poly_Triangulation {
    constructor(theHandle: Handle_Poly_Triangulation);
  }

export declare class Poly_Triangulation extends Standard_Transient {
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  Copy(): Handle_Poly_Triangulation;
  Deflection_1(): Standard_Real;
  Deflection_2(theDeflection: Standard_Real): void;
  Parameters_1(): Handle_Poly_TriangulationParameters;
  Parameters_2(theParams: Handle_Poly_TriangulationParameters): void;
  Clear(): void;
  HasGeometry(): Standard_Boolean;
  NbNodes(): Graphic3d_ZLayerId;
  NbTriangles(): Graphic3d_ZLayerId;
  HasUVNodes(): Standard_Boolean;
  HasNormals(): Standard_Boolean;
  Node(theIndex: Graphic3d_ZLayerId): gp_Pnt;
  SetNode(theIndex: Graphic3d_ZLayerId, thePnt: gp_Pnt): void;
  UVNode(theIndex: Graphic3d_ZLayerId): gp_Pnt2d;
  SetUVNode(theIndex: Graphic3d_ZLayerId, thePnt: gp_Pnt2d): void;
  Triangle(theIndex: Graphic3d_ZLayerId): Poly_Triangle;
  SetTriangle(theIndex: Graphic3d_ZLayerId, theTriangle: Poly_Triangle): void;
  Normal_1(theIndex: Graphic3d_ZLayerId): gp_Dir;
  Normal_2(theIndex: Graphic3d_ZLayerId, theVec3: gp_Vec3f): void;
  SetNormal_1(theIndex: Graphic3d_ZLayerId, theNormal: gp_Vec3f): void;
  SetNormal_2(theIndex: Graphic3d_ZLayerId, theNormal: gp_Dir): void;
  MeshPurpose(): Poly_MeshPurpose;
  SetMeshPurpose(thePurpose: Poly_MeshPurpose): void;
  CachedMinMax(): Bnd_Box;
  SetCachedMinMax(theBox: Bnd_Box): void;
  HasCachedMinMax(): Standard_Boolean;
  UpdateCachedMinMax(): void;
  MinMax(theBox: Bnd_Box, theTrsf: gp_Trsf, theIsAccurate: Standard_Boolean): Standard_Boolean;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  IsDoublePrecision(): Standard_Boolean;
  SetDoublePrecision(theIsDouble: Standard_Boolean): void;
  ResizeNodes(theNbNodes: Graphic3d_ZLayerId, theToCopyOld: Standard_Boolean): void;
  ResizeTriangles(theNbTriangles: Graphic3d_ZLayerId, theToCopyOld: Standard_Boolean): void;
  AddUVNodes(): void;
  RemoveUVNodes(): void;
  AddNormals(): void;
  RemoveNormals(): void;
  ComputeNormals(): void;
  MapNodeArray(): Handle_TColgp_HArray1OfPnt;
  MapTriangleArray(): Handle_Poly_HArray1OfTriangle;
  MapUVNodeArray(): Handle_TColgp_HArray1OfPnt2d;
  MapNormalArray(): Handle_TShort_HArray1OfShortReal;
  InternalTriangles(): Poly_Array1OfTriangle;
  InternalNodes(): Poly_ArrayOfNodes;
  InternalUVNodes(): Poly_ArrayOfUVNodes;
  InternalNormals(): any;
  SetNormals(theNormals: Handle_TShort_HArray1OfShortReal): void;
  Triangles(): Poly_Array1OfTriangle;
  ChangeTriangles(): Poly_Array1OfTriangle;
  ChangeTriangle(theIndex: Graphic3d_ZLayerId): Poly_Triangle;
  NbDeferredNodes(): Graphic3d_ZLayerId;
  NbDeferredTriangles(): Graphic3d_ZLayerId;
  HasDeferredData(): Standard_Boolean;
  LoadDeferredData(theFileSystem: any): Standard_Boolean;
  DetachedLoadDeferredData(theFileSystem: any): Handle_Poly_Triangulation;
  UnloadDeferredData(): Standard_Boolean;
  delete(): void;
}

  export declare class Poly_Triangulation_1 extends Poly_Triangulation {
    constructor();
  }

  export declare class Poly_Triangulation_2 extends Poly_Triangulation {
    constructor(theNbNodes: Graphic3d_ZLayerId, theNbTriangles: Graphic3d_ZLayerId, theHasUVNodes: Standard_Boolean, theHasNormals: Standard_Boolean);
  }

  export declare class Poly_Triangulation_3 extends Poly_Triangulation {
    constructor(Nodes: TColgp_Array1OfPnt, Triangles: Poly_Array1OfTriangle);
  }

  export declare class Poly_Triangulation_4 extends Poly_Triangulation {
    constructor(Nodes: TColgp_Array1OfPnt, UVNodes: TColgp_Array1OfPnt2d, Triangles: Poly_Array1OfTriangle);
  }

  export declare class Poly_Triangulation_5 extends Poly_Triangulation {
    constructor(theTriangulation: Handle_Poly_Triangulation);
  }

export declare class Poly_Array1OfTriangle {
  begin(): any;
  end(): any;
  cbegin(): any;
  cend(): any;
  Init(theValue: Poly_Triangle): void;
  Size(): Standard_Integer;
  Length(): Standard_Integer;
  IsEmpty(): Standard_Boolean;
  Lower(): Standard_Integer;
  Upper(): Standard_Integer;
  IsDeletable(): Standard_Boolean;
  IsAllocated(): Standard_Boolean;
  Assign(theOther: Poly_Array1OfTriangle): Poly_Array1OfTriangle;
  Move(theOther: Poly_Array1OfTriangle): Poly_Array1OfTriangle;
  First(): Poly_Triangle;
  ChangeFirst(): Poly_Triangle;
  Last(): Poly_Triangle;
  ChangeLast(): Poly_Triangle;
  Value(theIndex: Standard_Integer): Poly_Triangle;
  ChangeValue(theIndex: Standard_Integer): Poly_Triangle;
  SetValue(theIndex: Standard_Integer, theItem: Poly_Triangle): void;
  Resize(theLower: Standard_Integer, theUpper: Standard_Integer, theToCopyData: Standard_Boolean): void;
  delete(): void;
}

  export declare class Poly_Array1OfTriangle_1 extends Poly_Array1OfTriangle {
    constructor();
  }

  export declare class Poly_Array1OfTriangle_2 extends Poly_Array1OfTriangle {
    constructor(theLower: Standard_Integer, theUpper: Standard_Integer);
  }

  export declare class Poly_Array1OfTriangle_3 extends Poly_Array1OfTriangle {
    constructor(theOther: Poly_Array1OfTriangle);
  }

  export declare class Poly_Array1OfTriangle_4 extends Poly_Array1OfTriangle {
    constructor(theOther: Poly_Array1OfTriangle);
  }

  export declare class Poly_Array1OfTriangle_5 extends Poly_Array1OfTriangle {
    constructor(theBegin: Poly_Triangle, theLower: Standard_Integer, theUpper: Standard_Integer);
  }

export declare class Poly_Triangle {
  Set_1(theN1: Graphic3d_ZLayerId, theN2: Graphic3d_ZLayerId, theN3: Graphic3d_ZLayerId): void;
  Set_2(theIndex: Graphic3d_ZLayerId, theNode: Graphic3d_ZLayerId): void;
  Get(theN1: Graphic3d_ZLayerId, theN2: Graphic3d_ZLayerId, theN3: Graphic3d_ZLayerId): void;
  Value(theIndex: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  ChangeValue(theIndex: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  delete(): void;
}

  export declare class Poly_Triangle_1 extends Poly_Triangle {
    constructor();
  }

  export declare class Poly_Triangle_2 extends Poly_Triangle {
    constructor(theN1: Graphic3d_ZLayerId, theN2: Graphic3d_ZLayerId, theN3: Graphic3d_ZLayerId);
  }

export declare class TopoDS_Builder {
  constructor();
  MakeWire(W: TopoDS_Wire): void;
  MakeShell(S: TopoDS_Shell): void;
  MakeSolid(S: TopoDS_Solid): void;
  MakeCompSolid(C: TopoDS_CompSolid): void;
  MakeCompound(C: TopoDS_Compound): void;
  Add(S: TopoDS_Shape, C: TopoDS_Shape): void;
  Remove(S: TopoDS_Shape, C: TopoDS_Shape): void;
  delete(): void;
}

export declare class TopoDS {
  constructor();
  static Vertex_1(S: TopoDS_Shape): TopoDS_Vertex;
  static Vertex_2(a0: TopoDS_Shape): TopoDS_Vertex;
  static Edge_1(S: TopoDS_Shape): TopoDS_Edge;
  static Edge_2(a0: TopoDS_Shape): TopoDS_Edge;
  static Wire_1(S: TopoDS_Shape): TopoDS_Wire;
  static Wire_2(a0: TopoDS_Shape): TopoDS_Wire;
  static Face_1(S: TopoDS_Shape): TopoDS_Face;
  static Face_2(a0: TopoDS_Shape): TopoDS_Face;
  static Shell_1(S: TopoDS_Shape): TopoDS_Shell;
  static Shell_2(a0: TopoDS_Shape): TopoDS_Shell;
  static Solid_1(S: TopoDS_Shape): TopoDS_Solid;
  static Solid_2(a0: TopoDS_Shape): TopoDS_Solid;
  static CompSolid_1(S: TopoDS_Shape): TopoDS_CompSolid;
  static CompSolid_2(a0: TopoDS_Shape): TopoDS_CompSolid;
  static Compound_1(S: TopoDS_Shape): TopoDS_Compound;
  static Compound_2(a0: TopoDS_Shape): TopoDS_Compound;
  delete(): void;
}

export declare class TopoDS_Face extends TopoDS_Shape {
  constructor()
  delete(): void;
}

export declare class TopoDS_Compound extends TopoDS_Shape {
  constructor()
  delete(): void;
}

export declare class TopoDS_Edge extends TopoDS_Shape {
  constructor()
  delete(): void;
}

export declare class TopoDS_Shape {
  constructor()
  IsNull(): Standard_Boolean;
  Nullify(): void;
  Location_1(): TopLoc_Location;
  Location_2(theLoc: TopLoc_Location, theRaiseExc: Standard_Boolean): void;
  Located(theLoc: TopLoc_Location, theRaiseExc: Standard_Boolean): TopoDS_Shape;
  Orientation_1(): TopAbs_Orientation;
  Orientation_2(theOrient: TopAbs_Orientation): void;
  Oriented(theOrient: TopAbs_Orientation): TopoDS_Shape;
  TShape_1(): Handle_TopoDS_TShape;
  ShapeType(): TopAbs_ShapeEnum;
  Free_1(): Standard_Boolean;
  Free_2(theIsFree: Standard_Boolean): void;
  Locked_1(): Standard_Boolean;
  Locked_2(theIsLocked: Standard_Boolean): void;
  Modified_1(): Standard_Boolean;
  Modified_2(theIsModified: Standard_Boolean): void;
  Checked_1(): Standard_Boolean;
  Checked_2(theIsChecked: Standard_Boolean): void;
  Orientable_1(): Standard_Boolean;
  Orientable_2(theIsOrientable: Standard_Boolean): void;
  Closed_1(): Standard_Boolean;
  Closed_2(theIsClosed: Standard_Boolean): void;
  Infinite_1(): Standard_Boolean;
  Infinite_2(theIsInfinite: Standard_Boolean): void;
  Convex_1(): Standard_Boolean;
  Convex_2(theIsConvex: Standard_Boolean): void;
  Move(thePosition: TopLoc_Location, theRaiseExc: Standard_Boolean): void;
  Moved(thePosition: TopLoc_Location, theRaiseExc: Standard_Boolean): TopoDS_Shape;
  Reverse(): void;
  Reversed(): TopoDS_Shape;
  Complement(): void;
  Complemented(): TopoDS_Shape;
  Compose(theOrient: TopAbs_Orientation): void;
  Composed(theOrient: TopAbs_Orientation): TopoDS_Shape;
  NbChildren(): Graphic3d_ZLayerId;
  IsPartner(theOther: TopoDS_Shape): Standard_Boolean;
  IsSame(theOther: TopoDS_Shape): Standard_Boolean;
  IsEqual(theOther: TopoDS_Shape): Standard_Boolean;
  IsNotEqual(theOther: TopoDS_Shape): Standard_Boolean;
  HashCode(theUpperBound: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  EmptyCopy(): void;
  EmptyCopied(): TopoDS_Shape;
  TShape_2(theTShape: Handle_TopoDS_TShape): void;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  delete(): void;
}

export declare class TopLoc_Location {
  IsIdentity(): Standard_Boolean;
  Identity(): void;
  FirstDatum(): Handle_TopLoc_Datum3D;
  FirstPower(): Graphic3d_ZLayerId;
  NextLocation(): TopLoc_Location;
  Transformation(): gp_Trsf;
  Inverted(): TopLoc_Location;
  Multiplied(Other: TopLoc_Location): TopLoc_Location;
  Divided(Other: TopLoc_Location): TopLoc_Location;
  Predivided(Other: TopLoc_Location): TopLoc_Location;
  Powered(pwr: Graphic3d_ZLayerId): TopLoc_Location;
  HashCode(theUpperBound: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  IsEqual(Other: TopLoc_Location): Standard_Boolean;
  IsDifferent(Other: TopLoc_Location): Standard_Boolean;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  ShallowDump(S: Standard_OStream): void;
  Clear(): void;
  static ScalePrec(): Standard_Real;
  delete(): void;
}

  export declare class TopLoc_Location_1 extends TopLoc_Location {
    constructor();
  }

  export declare class TopLoc_Location_2 extends TopLoc_Location {
    constructor(T: gp_Trsf);
  }

  export declare class TopLoc_Location_3 extends TopLoc_Location {
    constructor(D: Handle_TopLoc_Datum3D);
  }

export declare class TColgp_Array1OfPnt {
  begin(): any;
  end(): any;
  cbegin(): any;
  cend(): any;
  Init(theValue: gp_Pnt): void;
  Size(): Standard_Integer;
  Length(): Standard_Integer;
  IsEmpty(): Standard_Boolean;
  Lower(): Standard_Integer;
  Upper(): Standard_Integer;
  IsDeletable(): Standard_Boolean;
  IsAllocated(): Standard_Boolean;
  Assign(theOther: TColgp_Array1OfPnt): TColgp_Array1OfPnt;
  Move(theOther: TColgp_Array1OfPnt): TColgp_Array1OfPnt;
  First(): gp_Pnt;
  ChangeFirst(): gp_Pnt;
  Last(): gp_Pnt;
  ChangeLast(): gp_Pnt;
  Value(theIndex: Standard_Integer): gp_Pnt;
  ChangeValue(theIndex: Standard_Integer): gp_Pnt;
  SetValue(theIndex: Standard_Integer, theItem: gp_Pnt): void;
  Resize(theLower: Standard_Integer, theUpper: Standard_Integer, theToCopyData: Standard_Boolean): void;
  delete(): void;
}

  export declare class TColgp_Array1OfPnt_1 extends TColgp_Array1OfPnt {
    constructor();
  }

  export declare class TColgp_Array1OfPnt_2 extends TColgp_Array1OfPnt {
    constructor(theLower: Standard_Integer, theUpper: Standard_Integer);
  }

  export declare class TColgp_Array1OfPnt_3 extends TColgp_Array1OfPnt {
    constructor(theOther: TColgp_Array1OfPnt);
  }

  export declare class TColgp_Array1OfPnt_4 extends TColgp_Array1OfPnt {
    constructor(theOther: TColgp_Array1OfPnt);
  }

  export declare class TColgp_Array1OfPnt_5 extends TColgp_Array1OfPnt {
    constructor(theBegin: gp_Pnt, theLower: Standard_Integer, theUpper: Standard_Integer);
  }

export declare class NCollection_BaseList {
  Extent(): Graphic3d_ZLayerId;
  IsEmpty(): Standard_Boolean;
  Allocator(): Handle_NCollection_BaseAllocator;
  delete(): void;
}

export declare class NCollection_BaseMap {
  NbBuckets(): Graphic3d_ZLayerId;
  Extent(): Graphic3d_ZLayerId;
  IsEmpty(): Standard_Boolean;
  Statistics(S: Standard_OStream): void;
  Allocator(): Handle_NCollection_BaseAllocator;
  delete(): void;
}

export declare class TopExp_Explorer {
  Init(S: TopoDS_Shape, ToFind: TopAbs_ShapeEnum, ToAvoid: TopAbs_ShapeEnum): void;
  More(): Standard_Boolean;
  Next(): void;
  Value(): TopoDS_Shape;
  Current(): TopoDS_Shape;
  ReInit(): void;
  ExploredShape(): TopoDS_Shape;
  Depth(): Graphic3d_ZLayerId;
  Clear(): void;
  delete(): void;
}

  export declare class TopExp_Explorer_1 extends TopExp_Explorer {
    constructor();
  }

  export declare class TopExp_Explorer_2 extends TopExp_Explorer {
    constructor(S: TopoDS_Shape, ToFind: TopAbs_ShapeEnum, ToAvoid: TopAbs_ShapeEnum);
  }

export declare class TopExp {
  constructor();
  static MapShapes_1(S: TopoDS_Shape, T: TopAbs_ShapeEnum, M: TopTools_IndexedMapOfShape): void;
  static MapShapes_2(S: TopoDS_Shape, M: TopTools_IndexedMapOfShape, cumOri: Standard_Boolean, cumLoc: Standard_Boolean): void;
  static MapShapes_3(S: TopoDS_Shape, M: TopTools_MapOfShape, cumOri: Standard_Boolean, cumLoc: Standard_Boolean): void;
  static MapShapesAndAncestors(S: TopoDS_Shape, TS: TopAbs_ShapeEnum, TA: TopAbs_ShapeEnum, M: TopTools_IndexedDataMapOfShapeListOfShape): void;
  static MapShapesAndUniqueAncestors(S: TopoDS_Shape, TS: TopAbs_ShapeEnum, TA: TopAbs_ShapeEnum, M: TopTools_IndexedDataMapOfShapeListOfShape, useOrientation: Standard_Boolean): void;
  static FirstVertex(E: TopoDS_Edge, CumOri: Standard_Boolean): TopoDS_Vertex;
  static LastVertex(E: TopoDS_Edge, CumOri: Standard_Boolean): TopoDS_Vertex;
  static Vertices_1(E: TopoDS_Edge, Vfirst: TopoDS_Vertex, Vlast: TopoDS_Vertex, CumOri: Standard_Boolean): void;
  static Vertices_2(W: TopoDS_Wire, Vfirst: TopoDS_Vertex, Vlast: TopoDS_Vertex): void;
  static CommonVertex(E1: TopoDS_Edge, E2: TopoDS_Edge, V: TopoDS_Vertex): Standard_Boolean;
  delete(): void;
}

export declare class GProp_GProps {
  Add(Item: GProp_GProps, Density: Standard_Real): void;
  Mass(): Standard_Real;
  CentreOfMass(): gp_Pnt;
  MatrixOfInertia(): gp_Mat;
  StaticMoments(Ix: Standard_Real, Iy: Standard_Real, Iz: Standard_Real): void;
  MomentOfInertia(A: gp_Ax1): Standard_Real;
  PrincipalProperties(): GProp_PrincipalProps;
  RadiusOfGyration(A: gp_Ax1): Standard_Real;
  delete(): void;
}

  export declare class GProp_GProps_1 extends GProp_GProps {
    constructor();
  }

  export declare class GProp_GProps_2 extends GProp_GProps {
    constructor(SystemLocation: gp_Pnt);
  }

export declare class BRepPrimAPI_MakeOneAxis extends BRepBuilderAPI_MakeShape {
  OneAxis(): Standard_Address;
  Build(theRange: Message_ProgressRange): void;
  Face(): TopoDS_Face;
  Shell(): TopoDS_Shell;
  Solid(): TopoDS_Solid;
  delete(): void;
}

export declare class BRepPrimAPI_MakeBox extends BRepBuilderAPI_MakeShape {
  Init_1(theDX: Standard_Real, theDY: Standard_Real, theDZ: Standard_Real): void;
  Init_2(thePnt: gp_Pnt, theDX: Standard_Real, theDY: Standard_Real, theDZ: Standard_Real): void;
  Init_3(thePnt1: gp_Pnt, thePnt2: gp_Pnt): void;
  Init_4(theAxes: gp_Ax2, theDX: Standard_Real, theDY: Standard_Real, theDZ: Standard_Real): void;
  Wedge(): BRepPrim_Wedge;
  Build(theRange: Message_ProgressRange): void;
  Shell(): TopoDS_Shell;
  Solid(): TopoDS_Solid;
  BottomFace(): TopoDS_Face;
  BackFace(): TopoDS_Face;
  FrontFace(): TopoDS_Face;
  LeftFace(): TopoDS_Face;
  RightFace(): TopoDS_Face;
  TopFace(): TopoDS_Face;
  delete(): void;
}

  export declare class BRepPrimAPI_MakeBox_1 extends BRepPrimAPI_MakeBox {
    constructor();
  }

  export declare class BRepPrimAPI_MakeBox_2 extends BRepPrimAPI_MakeBox {
    constructor(dx: Standard_Real, dy: Standard_Real, dz: Standard_Real);
  }

  export declare class BRepPrimAPI_MakeBox_3 extends BRepPrimAPI_MakeBox {
    constructor(P: gp_Pnt, dx: Standard_Real, dy: Standard_Real, dz: Standard_Real);
  }

  export declare class BRepPrimAPI_MakeBox_4 extends BRepPrimAPI_MakeBox {
    constructor(P1: gp_Pnt, P2: gp_Pnt);
  }

  export declare class BRepPrimAPI_MakeBox_5 extends BRepPrimAPI_MakeBox {
    constructor(Axes: gp_Ax2, dx: Standard_Real, dy: Standard_Real, dz: Standard_Real);
  }

export declare class BRepPrimAPI_MakeSweep extends BRepBuilderAPI_MakeShape {
  FirstShape(): TopoDS_Shape;
  LastShape(): TopoDS_Shape;
  delete(): void;
}

export declare class BRepPrimAPI_MakeHalfSpace extends BRepBuilderAPI_MakeShape {
  Solid(): TopoDS_Solid;
  delete(): void;
}

  export declare class BRepPrimAPI_MakeHalfSpace_1 extends BRepPrimAPI_MakeHalfSpace {
    constructor(Face: TopoDS_Face, RefPnt: gp_Pnt);
  }

  export declare class BRepPrimAPI_MakeHalfSpace_2 extends BRepPrimAPI_MakeHalfSpace {
    constructor(Shell: TopoDS_Shell, RefPnt: gp_Pnt);
  }

export declare class BRepPrimAPI_MakeCylinder extends BRepPrimAPI_MakeOneAxis {
  OneAxis(): Standard_Address;
  Cylinder(): BRepPrim_Cylinder;
  delete(): void;
}

  export declare class BRepPrimAPI_MakeCylinder_1 extends BRepPrimAPI_MakeCylinder {
    constructor(R: Standard_Real, H: Standard_Real);
  }

  export declare class BRepPrimAPI_MakeCylinder_2 extends BRepPrimAPI_MakeCylinder {
    constructor(R: Standard_Real, H: Standard_Real, Angle: Standard_Real);
  }

  export declare class BRepPrimAPI_MakeCylinder_3 extends BRepPrimAPI_MakeCylinder {
    constructor(Axes: gp_Ax2, R: Standard_Real, H: Standard_Real);
  }

  export declare class BRepPrimAPI_MakeCylinder_4 extends BRepPrimAPI_MakeCylinder {
    constructor(Axes: gp_Ax2, R: Standard_Real, H: Standard_Real, Angle: Standard_Real);
  }

export declare class gp_Trsf {
  SetMirror_1(theP: gp_Pnt): void;
  SetMirror_2(theA1: gp_Ax1): void;
  SetMirror_3(theA2: gp_Ax2): void;
  SetRotation_1(theA1: gp_Ax1, theAng: Standard_Real): void;
  SetRotation_2(theR: gp_Quaternion): void;
  SetRotationPart(theR: gp_Quaternion): void;
  SetScale(theP: gp_Pnt, theS: Standard_Real): void;
  SetDisplacement(theFromSystem1: gp_Ax3, theToSystem2: gp_Ax3): void;
  SetTransformation_1(theFromSystem1: gp_Ax3, theToSystem2: gp_Ax3): void;
  SetTransformation_2(theToSystem: gp_Ax3): void;
  SetTransformation_3(R: gp_Quaternion, theT: gp_Vec): void;
  SetTranslation_1(theV: gp_Vec): void;
  SetTranslation_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  SetTranslationPart(theV: gp_Vec): void;
  SetScaleFactor(theS: Standard_Real): void;
  SetForm(theP: gp_TrsfForm): void;
  SetValues(a11: Standard_Real, a12: Standard_Real, a13: Standard_Real, a14: Standard_Real, a21: Standard_Real, a22: Standard_Real, a23: Standard_Real, a24: Standard_Real, a31: Standard_Real, a32: Standard_Real, a33: Standard_Real, a34: Standard_Real): void;
  IsNegative(): Standard_Boolean;
  Form(): gp_TrsfForm;
  ScaleFactor(): Standard_Real;
  TranslationPart(): gp_XYZ;
  GetRotation_1(theAxis: gp_XYZ, theAngle: Standard_Real): Standard_Boolean;
  GetRotation_2(): gp_Quaternion;
  VectorialPart(): gp_Mat;
  HVectorialPart(): gp_Mat;
  Value(theRow: Graphic3d_ZLayerId, theCol: Graphic3d_ZLayerId): Standard_Real;
  Invert(): void;
  Inverted(): gp_Trsf;
  Multiplied(theT: gp_Trsf): gp_Trsf;
  Multiply(theT: gp_Trsf): void;
  PreMultiply(theT: gp_Trsf): void;
  Power(theN: Graphic3d_ZLayerId): void;
  Powered(theN: Graphic3d_ZLayerId): gp_Trsf;
  Transforms_1(theX: Standard_Real, theY: Standard_Real, theZ: Standard_Real): void;
  Transforms_2(theCoord: gp_XYZ): void;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Trsf_1 extends gp_Trsf {
    constructor();
  }

  export declare class gp_Trsf_2 extends gp_Trsf {
    constructor(theT: gp_Trsf2d);
  }

export declare class gp_Vec {
  SetCoord_1(theIndex: Graphic3d_ZLayerId, theXi: Standard_Real): void;
  SetCoord_2(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real): void;
  SetX(theX: Standard_Real): void;
  SetY(theY: Standard_Real): void;
  SetZ(theZ: Standard_Real): void;
  SetXYZ(theCoord: gp_XYZ): void;
  Coord_1(theIndex: Graphic3d_ZLayerId): Standard_Real;
  Coord_2(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real): void;
  X(): Standard_Real;
  Y(): Standard_Real;
  Z(): Standard_Real;
  XYZ(): gp_XYZ;
  IsEqual(theOther: gp_Vec, theLinearTolerance: Standard_Real, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsNormal(theOther: gp_Vec, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsOpposite(theOther: gp_Vec, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsParallel(theOther: gp_Vec, theAngularTolerance: Standard_Real): Standard_Boolean;
  Angle(theOther: gp_Vec): Standard_Real;
  AngleWithRef(theOther: gp_Vec, theVRef: gp_Vec): Standard_Real;
  Magnitude(): Standard_Real;
  SquareMagnitude(): Standard_Real;
  Add(theOther: gp_Vec): void;
  Added(theOther: gp_Vec): gp_Vec;
  Subtract(theRight: gp_Vec): void;
  Subtracted(theRight: gp_Vec): gp_Vec;
  Multiply(theScalar: Standard_Real): void;
  Multiplied(theScalar: Standard_Real): gp_Vec;
  Divide(theScalar: Standard_Real): void;
  Divided(theScalar: Standard_Real): gp_Vec;
  Cross(theRight: gp_Vec): void;
  Crossed(theRight: gp_Vec): gp_Vec;
  CrossMagnitude(theRight: gp_Vec): Standard_Real;
  CrossSquareMagnitude(theRight: gp_Vec): Standard_Real;
  CrossCross(theV1: gp_Vec, theV2: gp_Vec): void;
  CrossCrossed(theV1: gp_Vec, theV2: gp_Vec): gp_Vec;
  Dot(theOther: gp_Vec): Standard_Real;
  DotCross(theV1: gp_Vec, theV2: gp_Vec): Standard_Real;
  Normalize(): void;
  Normalized(): gp_Vec;
  Reverse(): void;
  Reversed(): gp_Vec;
  SetLinearForm_1(theA1: Standard_Real, theV1: gp_Vec, theA2: Standard_Real, theV2: gp_Vec, theA3: Standard_Real, theV3: gp_Vec, theV4: gp_Vec): void;
  SetLinearForm_2(theA1: Standard_Real, theV1: gp_Vec, theA2: Standard_Real, theV2: gp_Vec, theA3: Standard_Real, theV3: gp_Vec): void;
  SetLinearForm_3(theA1: Standard_Real, theV1: gp_Vec, theA2: Standard_Real, theV2: gp_Vec, theV3: gp_Vec): void;
  SetLinearForm_4(theA1: Standard_Real, theV1: gp_Vec, theA2: Standard_Real, theV2: gp_Vec): void;
  SetLinearForm_5(theA1: Standard_Real, theV1: gp_Vec, theV2: gp_Vec): void;
  SetLinearForm_6(theV1: gp_Vec, theV2: gp_Vec): void;
  Mirror_1(theV: gp_Vec): void;
  Mirrored_1(theV: gp_Vec): gp_Vec;
  Mirror_2(theA1: gp_Ax1): void;
  Mirrored_2(theA1: gp_Ax1): gp_Vec;
  Mirror_3(theA2: gp_Ax2): void;
  Mirrored_3(theA2: gp_Ax2): gp_Vec;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Vec;
  Scale(theS: Standard_Real): void;
  Scaled(theS: Standard_Real): gp_Vec;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Vec;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  delete(): void;
}

  export declare class gp_Vec_1 extends gp_Vec {
    constructor();
  }

  export declare class gp_Vec_2 extends gp_Vec {
    constructor(theV: gp_Dir);
  }

  export declare class gp_Vec_3 extends gp_Vec {
    constructor(theCoord: gp_XYZ);
  }

  export declare class gp_Vec_4 extends gp_Vec {
    constructor(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real);
  }

  export declare class gp_Vec_5 extends gp_Vec {
    constructor(theP1: gp_Pnt, theP2: gp_Pnt);
  }

export declare class gp_Ax3 {
  XReverse(): void;
  YReverse(): void;
  ZReverse(): void;
  SetAxis(theA1: gp_Ax1): void;
  SetDirection(theV: gp_Dir): void;
  SetLocation(theP: gp_Pnt): void;
  SetXDirection(theVx: gp_Dir): void;
  SetYDirection(theVy: gp_Dir): void;
  Angle(theOther: gp_Ax3): Standard_Real;
  Axis(): gp_Ax1;
  Ax2(): gp_Ax2;
  Direction(): gp_Dir;
  Location(): gp_Pnt;
  XDirection(): gp_Dir;
  YDirection(): gp_Dir;
  Direct(): Standard_Boolean;
  IsCoplanar_1(theOther: gp_Ax3, theLinearTolerance: Standard_Real, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsCoplanar_2(theA1: gp_Ax1, theLinearTolerance: Standard_Real, theAngularTolerance: Standard_Real): Standard_Boolean;
  Mirror_1(theP: gp_Pnt): void;
  Mirrored_1(theP: gp_Pnt): gp_Ax3;
  Mirror_2(theA1: gp_Ax1): void;
  Mirrored_2(theA1: gp_Ax1): gp_Ax3;
  Mirror_3(theA2: gp_Ax2): void;
  Mirrored_3(theA2: gp_Ax2): gp_Ax3;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Ax3;
  Scale(theP: gp_Pnt, theS: Standard_Real): void;
  Scaled(theP: gp_Pnt, theS: Standard_Real): gp_Ax3;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Ax3;
  Translate_1(theV: gp_Vec): void;
  Translated_1(theV: gp_Vec): gp_Ax3;
  Translate_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  Translated_2(theP1: gp_Pnt, theP2: gp_Pnt): gp_Ax3;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Ax3_1 extends gp_Ax3 {
    constructor();
  }

  export declare class gp_Ax3_2 extends gp_Ax3 {
    constructor(theA: gp_Ax2);
  }

  export declare class gp_Ax3_3 extends gp_Ax3 {
    constructor(theP: gp_Pnt, theN: gp_Dir, theVx: gp_Dir);
  }

  export declare class gp_Ax3_4 extends gp_Ax3 {
    constructor(theP: gp_Pnt, theV: gp_Dir);
  }

export declare class gp_Ax1 {
  SetDirection(theV: gp_Dir): void;
  SetLocation(theP: gp_Pnt): void;
  Direction(): gp_Dir;
  Location(): gp_Pnt;
  IsCoaxial(Other: gp_Ax1, AngularTolerance: Standard_Real, LinearTolerance: Standard_Real): Standard_Boolean;
  IsNormal(theOther: gp_Ax1, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsOpposite(theOther: gp_Ax1, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsParallel(theOther: gp_Ax1, theAngularTolerance: Standard_Real): Standard_Boolean;
  Angle(theOther: gp_Ax1): Standard_Real;
  Reverse(): void;
  Reversed(): gp_Ax1;
  Mirror_1(P: gp_Pnt): void;
  Mirrored_1(P: gp_Pnt): gp_Ax1;
  Mirror_2(A1: gp_Ax1): void;
  Mirrored_2(A1: gp_Ax1): gp_Ax1;
  Mirror_3(A2: gp_Ax2): void;
  Mirrored_3(A2: gp_Ax2): gp_Ax1;
  Rotate(theA1: gp_Ax1, theAngRad: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAngRad: Standard_Real): gp_Ax1;
  Scale(theP: gp_Pnt, theS: Standard_Real): void;
  Scaled(theP: gp_Pnt, theS: Standard_Real): gp_Ax1;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Ax1;
  Translate_1(theV: gp_Vec): void;
  Translated_1(theV: gp_Vec): gp_Ax1;
  Translate_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  Translated_2(theP1: gp_Pnt, theP2: gp_Pnt): gp_Ax1;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Ax1_1 extends gp_Ax1 {
    constructor();
  }

  export declare class gp_Ax1_2 extends gp_Ax1 {
    constructor(theP: gp_Pnt, theV: gp_Dir);
  }

export declare class gp_Pln {
  Coefficients(theA: Standard_Real, theB: Standard_Real, theC: Standard_Real, theD: Standard_Real): void;
  SetAxis(theA1: gp_Ax1): void;
  SetLocation(theLoc: gp_Pnt): void;
  SetPosition(theA3: gp_Ax3): void;
  UReverse(): void;
  VReverse(): void;
  Direct(): Standard_Boolean;
  Axis(): gp_Ax1;
  Location(): gp_Pnt;
  Position(): gp_Ax3;
  Distance_1(theP: gp_Pnt): Standard_Real;
  Distance_2(theL: gp_Lin): Standard_Real;
  Distance_3(theOther: gp_Pln): Standard_Real;
  SquareDistance_1(theP: gp_Pnt): Standard_Real;
  SquareDistance_2(theL: gp_Lin): Standard_Real;
  SquareDistance_3(theOther: gp_Pln): Standard_Real;
  XAxis(): gp_Ax1;
  YAxis(): gp_Ax1;
  Contains_1(theP: gp_Pnt, theLinearTolerance: Standard_Real): Standard_Boolean;
  Contains_2(theL: gp_Lin, theLinearTolerance: Standard_Real, theAngularTolerance: Standard_Real): Standard_Boolean;
  Mirror_1(theP: gp_Pnt): void;
  Mirrored_1(theP: gp_Pnt): gp_Pln;
  Mirror_2(theA1: gp_Ax1): void;
  Mirrored_2(theA1: gp_Ax1): gp_Pln;
  Mirror_3(theA2: gp_Ax2): void;
  Mirrored_3(theA2: gp_Ax2): gp_Pln;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Pln;
  Scale(theP: gp_Pnt, theS: Standard_Real): void;
  Scaled(theP: gp_Pnt, theS: Standard_Real): gp_Pln;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Pln;
  Translate_1(theV: gp_Vec): void;
  Translated_1(theV: gp_Vec): gp_Pln;
  Translate_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  Translated_2(theP1: gp_Pnt, theP2: gp_Pnt): gp_Pln;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  delete(): void;
}

  export declare class gp_Pln_1 extends gp_Pln {
    constructor();
  }

  export declare class gp_Pln_2 extends gp_Pln {
    constructor(theA3: gp_Ax3);
  }

  export declare class gp_Pln_3 extends gp_Pln {
    constructor(theP: gp_Pnt, theV: gp_Dir);
  }

  export declare class gp_Pln_4 extends gp_Pln {
    constructor(theA: Standard_Real, theB: Standard_Real, theC: Standard_Real, theD: Standard_Real);
  }

export declare class gp_Ax2 {
  SetAxis(A1: gp_Ax1): void;
  SetDirection(V: gp_Dir): void;
  SetLocation(theP: gp_Pnt): void;
  SetXDirection(theVx: gp_Dir): void;
  SetYDirection(theVy: gp_Dir): void;
  Angle(theOther: gp_Ax2): Standard_Real;
  Axis(): gp_Ax1;
  Direction(): gp_Dir;
  Location(): gp_Pnt;
  XDirection(): gp_Dir;
  YDirection(): gp_Dir;
  IsCoplanar_1(Other: gp_Ax2, LinearTolerance: Standard_Real, AngularTolerance: Standard_Real): Standard_Boolean;
  IsCoplanar_2(A1: gp_Ax1, LinearTolerance: Standard_Real, AngularTolerance: Standard_Real): Standard_Boolean;
  Mirror_1(P: gp_Pnt): void;
  Mirrored_1(P: gp_Pnt): gp_Ax2;
  Mirror_2(A1: gp_Ax1): void;
  Mirrored_2(A1: gp_Ax1): gp_Ax2;
  Mirror_3(A2: gp_Ax2): void;
  Mirrored_3(A2: gp_Ax2): gp_Ax2;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Ax2;
  Scale(theP: gp_Pnt, theS: Standard_Real): void;
  Scaled(theP: gp_Pnt, theS: Standard_Real): gp_Ax2;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Ax2;
  Translate_1(theV: gp_Vec): void;
  Translated_1(theV: gp_Vec): gp_Ax2;
  Translate_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  Translated_2(theP1: gp_Pnt, theP2: gp_Pnt): gp_Ax2;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Ax2_1 extends gp_Ax2 {
    constructor();
  }

  export declare class gp_Ax2_2 extends gp_Ax2 {
    constructor(P: gp_Pnt, N: gp_Dir, Vx: gp_Dir);
  }

  export declare class gp_Ax2_3 extends gp_Ax2 {
    constructor(P: gp_Pnt, V: gp_Dir);
  }

export declare class gp_Pnt {
  SetCoord_1(theIndex: Graphic3d_ZLayerId, theXi: Standard_Real): void;
  SetCoord_2(theXp: Standard_Real, theYp: Standard_Real, theZp: Standard_Real): void;
  SetX(theX: Standard_Real): void;
  SetY(theY: Standard_Real): void;
  SetZ(theZ: Standard_Real): void;
  SetXYZ(theCoord: gp_XYZ): void;
  Coord_1(theIndex: Graphic3d_ZLayerId): Standard_Real;
  Coord_2(theXp: Standard_Real, theYp: Standard_Real, theZp: Standard_Real): void;
  X(): Standard_Real;
  Y(): Standard_Real;
  Z(): Standard_Real;
  XYZ(): gp_XYZ;
  Coord_3(): gp_XYZ;
  ChangeCoord(): gp_XYZ;
  BaryCenter(theAlpha: Standard_Real, theP: gp_Pnt, theBeta: Standard_Real): void;
  IsEqual(theOther: gp_Pnt, theLinearTolerance: Standard_Real): Standard_Boolean;
  Distance(theOther: gp_Pnt): Standard_Real;
  SquareDistance(theOther: gp_Pnt): Standard_Real;
  Mirror_1(theP: gp_Pnt): void;
  Mirrored_1(theP: gp_Pnt): gp_Pnt;
  Mirror_2(theA1: gp_Ax1): void;
  Mirrored_2(theA1: gp_Ax1): gp_Pnt;
  Mirror_3(theA2: gp_Ax2): void;
  Mirrored_3(theA2: gp_Ax2): gp_Pnt;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Pnt;
  Scale(theP: gp_Pnt, theS: Standard_Real): void;
  Scaled(theP: gp_Pnt, theS: Standard_Real): gp_Pnt;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Pnt;
  Translate_1(theV: gp_Vec): void;
  Translated_1(theV: gp_Vec): gp_Pnt;
  Translate_2(theP1: gp_Pnt, theP2: gp_Pnt): void;
  Translated_2(theP1: gp_Pnt, theP2: gp_Pnt): gp_Pnt;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Pnt_1 extends gp_Pnt {
    constructor();
  }

  export declare class gp_Pnt_2 extends gp_Pnt {
    constructor(theCoord: gp_XYZ);
  }

  export declare class gp_Pnt_3 extends gp_Pnt {
    constructor(theXp: Standard_Real, theYp: Standard_Real, theZp: Standard_Real);
  }

export declare class gp_Dir {
  SetCoord_1(theIndex: Graphic3d_ZLayerId, theXi: Standard_Real): void;
  SetCoord_2(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real): void;
  SetX(theX: Standard_Real): void;
  SetY(theY: Standard_Real): void;
  SetZ(theZ: Standard_Real): void;
  SetXYZ(theCoord: gp_XYZ): void;
  Coord_1(theIndex: Graphic3d_ZLayerId): Standard_Real;
  Coord_2(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real): void;
  X(): Standard_Real;
  Y(): Standard_Real;
  Z(): Standard_Real;
  XYZ(): gp_XYZ;
  IsEqual(theOther: gp_Dir, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsNormal(theOther: gp_Dir, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsOpposite(theOther: gp_Dir, theAngularTolerance: Standard_Real): Standard_Boolean;
  IsParallel(theOther: gp_Dir, theAngularTolerance: Standard_Real): Standard_Boolean;
  Angle(theOther: gp_Dir): Standard_Real;
  AngleWithRef(theOther: gp_Dir, theVRef: gp_Dir): Standard_Real;
  Cross(theRight: gp_Dir): void;
  Crossed(theRight: gp_Dir): gp_Dir;
  CrossCross(theV1: gp_Dir, theV2: gp_Dir): void;
  CrossCrossed(theV1: gp_Dir, theV2: gp_Dir): gp_Dir;
  Dot(theOther: gp_Dir): Standard_Real;
  DotCross(theV1: gp_Dir, theV2: gp_Dir): Standard_Real;
  Reverse(): void;
  Reversed(): gp_Dir;
  Mirror_1(theV: gp_Dir): void;
  Mirrored_1(theV: gp_Dir): gp_Dir;
  Mirror_2(theA1: gp_Ax1): void;
  Mirrored_2(theA1: gp_Ax1): gp_Dir;
  Mirror_3(theA2: gp_Ax2): void;
  Mirrored_3(theA2: gp_Ax2): gp_Dir;
  Rotate(theA1: gp_Ax1, theAng: Standard_Real): void;
  Rotated(theA1: gp_Ax1, theAng: Standard_Real): gp_Dir;
  Transform(theT: gp_Trsf): void;
  Transformed(theT: gp_Trsf): gp_Dir;
  DumpJson(theOStream: Standard_OStream, theDepth: Graphic3d_ZLayerId): void;
  InitFromJson(theSStream: Standard_SStream, theStreamPos: Graphic3d_ZLayerId): Standard_Boolean;
  delete(): void;
}

  export declare class gp_Dir_1 extends gp_Dir {
    constructor();
  }

  export declare class gp_Dir_2 extends gp_Dir {
    constructor(theV: gp_Vec);
  }

  export declare class gp_Dir_3 extends gp_Dir {
    constructor(theCoord: gp_XYZ);
  }

  export declare class gp_Dir_4 extends gp_Dir {
    constructor(theXv: Standard_Real, theYv: Standard_Real, theZv: Standard_Real);
  }

export declare class Adaptor3d_Curve extends Standard_Transient {
  constructor();
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  ShallowCopy(): Handle_Adaptor3d_Curve;
  FirstParameter(): Standard_Real;
  LastParameter(): Standard_Real;
  Continuity(): GeomAbs_Shape;
  NbIntervals(S: GeomAbs_Shape): Graphic3d_ZLayerId;
  Intervals(T: IntTools_CArray1OfReal, S: GeomAbs_Shape): void;
  Trim(First: Standard_Real, Last: Standard_Real, Tol: Standard_Real): Handle_Adaptor3d_Curve;
  IsClosed(): Standard_Boolean;
  IsPeriodic(): Standard_Boolean;
  Period(): Standard_Real;
  Value(U: Standard_Real): gp_Pnt;
  D0(U: Standard_Real, P: gp_Pnt): void;
  D1(U: Standard_Real, P: gp_Pnt, V: gp_Vec): void;
  D2(U: Standard_Real, P: gp_Pnt, V1: gp_Vec, V2: gp_Vec): void;
  D3(U: Standard_Real, P: gp_Pnt, V1: gp_Vec, V2: gp_Vec, V3: gp_Vec): void;
  DN(U: Standard_Real, N: Graphic3d_ZLayerId): gp_Vec;
  Resolution(R3d: Standard_Real): Standard_Real;
  GetType(): GeomAbs_CurveType;
  Line(): gp_Lin;
  Circle(): gp_Circ;
  Ellipse(): gp_Elips;
  Hyperbola(): gp_Hypr;
  Parabola(): gp_Parab;
  Degree(): Graphic3d_ZLayerId;
  IsRational(): Standard_Boolean;
  NbPoles(): Graphic3d_ZLayerId;
  NbKnots(): Graphic3d_ZLayerId;
  Bezier(): Handle_Geom_BezierCurve;
  BSpline(): Handle_Geom_BSplineCurve;
  OffsetCurve(): Handle_Geom_OffsetCurve;
  delete(): void;
}

export declare class TopTools_ListOfShape extends NCollection_BaseList {
  begin(): any;
  end(): any;
  cbegin(): any;
  cend(): any;
  Size(): Standard_Integer;
  Assign(theOther: TopTools_ListOfShape): TopTools_ListOfShape;
  Clear(theAllocator: Handle_NCollection_BaseAllocator): void;
  First_1(): TopoDS_Shape;
  First_2(): TopoDS_Shape;
  Last_1(): TopoDS_Shape;
  Last_2(): TopoDS_Shape;
  Append_1(theItem: TopoDS_Shape): TopoDS_Shape;
  Append_3(theOther: TopTools_ListOfShape): void;
  Prepend_1(theItem: TopoDS_Shape): TopoDS_Shape;
  Prepend_2(theOther: TopTools_ListOfShape): void;
  RemoveFirst(): void;
  Reverse(): void;
  delete(): void;
}

  export declare class TopTools_ListOfShape_1 extends TopTools_ListOfShape {
    constructor();
  }

  export declare class TopTools_ListOfShape_2 extends TopTools_ListOfShape {
    constructor(theAllocator: Handle_NCollection_BaseAllocator);
  }

  export declare class TopTools_ListOfShape_3 extends TopTools_ListOfShape {
    constructor(theOther: TopTools_ListOfShape);
  }

export declare class TopTools_IndexedDataMapOfShapeListOfShape extends NCollection_BaseMap {
  begin(): any;
  end(): any;
  cbegin(): any;
  cend(): any;
  Exchange(theOther: TopTools_IndexedDataMapOfShapeListOfShape): void;
  Assign(theOther: TopTools_IndexedDataMapOfShapeListOfShape): TopTools_IndexedDataMapOfShapeListOfShape;
  ReSize(N: Standard_Integer): void;
  Add(theKey1: TopoDS_Shape, theItem: TopTools_ListOfShape): Standard_Integer;
  Contains(theKey1: TopoDS_Shape): Standard_Boolean;
  Substitute(theIndex: Standard_Integer, theKey1: TopoDS_Shape, theItem: TopTools_ListOfShape): void;
  Swap(theIndex1: Standard_Integer, theIndex2: Standard_Integer): void;
  RemoveLast(): void;
  RemoveFromIndex(theIndex: Standard_Integer): void;
  RemoveKey(theKey1: TopoDS_Shape): void;
  FindKey(theIndex: Standard_Integer): TopoDS_Shape;
  FindFromIndex(theIndex: Standard_Integer): TopTools_ListOfShape;
  ChangeFromIndex(theIndex: Standard_Integer): TopTools_ListOfShape;
  FindIndex(theKey1: TopoDS_Shape): Standard_Integer;
  ChangeFromKey(theKey1: TopoDS_Shape): TopTools_ListOfShape;
  Seek(theKey1: TopoDS_Shape): TopTools_ListOfShape;
  ChangeSeek(theKey1: TopoDS_Shape): TopTools_ListOfShape;
  Clear_1(doReleaseMemory: Standard_Boolean): void;
  Clear_2(theAllocator: Handle_NCollection_BaseAllocator): void;
  Size(): Standard_Integer;
  delete(): void;
}

  export declare class TopTools_IndexedDataMapOfShapeListOfShape_1 extends TopTools_IndexedDataMapOfShapeListOfShape {
    constructor();
  }

  export declare class TopTools_IndexedDataMapOfShapeListOfShape_2 extends TopTools_IndexedDataMapOfShapeListOfShape {
    constructor(theNbBuckets: Standard_Integer, theAllocator: Handle_NCollection_BaseAllocator);
  }

  export declare class TopTools_IndexedDataMapOfShapeListOfShape_3 extends TopTools_IndexedDataMapOfShapeListOfShape {
    constructor(theOther: TopTools_IndexedDataMapOfShapeListOfShape);
  }

export declare class TopTools_IndexedMapOfShape extends NCollection_BaseMap {
  cbegin(): any;
  cend(): any;
  Exchange(theOther: TopTools_IndexedMapOfShape): void;
  Assign(theOther: TopTools_IndexedMapOfShape): TopTools_IndexedMapOfShape;
  ReSize(theExtent: Standard_Integer): void;
  Add(theKey1: TopoDS_Shape): Standard_Integer;
  Contains(theKey1: TopoDS_Shape): Standard_Boolean;
  Substitute(theIndex: Standard_Integer, theKey1: TopoDS_Shape): void;
  Swap(theIndex1: Standard_Integer, theIndex2: Standard_Integer): void;
  RemoveLast(): void;
  RemoveFromIndex(theIndex: Standard_Integer): void;
  RemoveKey(theKey1: TopoDS_Shape): Standard_Boolean;
  FindKey(theIndex: Standard_Integer): TopoDS_Shape;
  FindIndex(theKey1: TopoDS_Shape): Standard_Integer;
  Clear_1(doReleaseMemory: Standard_Boolean): void;
  Clear_2(theAllocator: Handle_NCollection_BaseAllocator): void;
  Size(): Standard_Integer;
  delete(): void;
}

  export declare class TopTools_IndexedMapOfShape_1 extends TopTools_IndexedMapOfShape {
    constructor();
  }

  export declare class TopTools_IndexedMapOfShape_2 extends TopTools_IndexedMapOfShape {
    constructor(theNbBuckets: Standard_Integer, theAllocator: Handle_NCollection_BaseAllocator);
  }

  export declare class TopTools_IndexedMapOfShape_3 extends TopTools_IndexedMapOfShape {
    constructor(theOther: TopTools_IndexedMapOfShape);
  }

export declare type GeomAbs_Shape = {
  GeomAbs_C0: {};
  GeomAbs_G1: {};
  GeomAbs_C1: {};
  GeomAbs_G2: {};
  GeomAbs_C2: {};
  GeomAbs_C3: {};
  GeomAbs_CN: {};
}

export declare class Handle_BRepAdaptor_Curve {
  Nullify(): void;
  IsNull(): boolean;
  reset(thePtr: BRepAdaptor_Curve): void;
  get(): BRepAdaptor_Curve;
  delete(): void;
}

  export declare class Handle_BRepAdaptor_Curve_1 extends Handle_BRepAdaptor_Curve {
    constructor();
  }

  export declare class Handle_BRepAdaptor_Curve_2 extends Handle_BRepAdaptor_Curve {
    constructor(thePtr: BRepAdaptor_Curve);
  }

  export declare class Handle_BRepAdaptor_Curve_3 extends Handle_BRepAdaptor_Curve {
    constructor(theHandle: Handle_BRepAdaptor_Curve);
  }

  export declare class Handle_BRepAdaptor_Curve_4 extends Handle_BRepAdaptor_Curve {
    constructor(theHandle: Handle_BRepAdaptor_Curve);
  }

export declare class BRepAdaptor_Curve extends Adaptor3d_Curve {
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  ShallowCopy(): Handle_Adaptor3d_Curve;
  Reset(): void;
  Initialize_1(E: TopoDS_Edge): void;
  Initialize_2(E: TopoDS_Edge, F: TopoDS_Face): void;
  Trsf(): gp_Trsf;
  Is3DCurve(): Standard_Boolean;
  IsCurveOnSurface(): Standard_Boolean;
  Curve(): GeomAdaptor_Curve;
  CurveOnSurface(): Adaptor3d_CurveOnSurface;
  Edge(): TopoDS_Edge;
  Tolerance(): Standard_Real;
  FirstParameter(): Standard_Real;
  LastParameter(): Standard_Real;
  Continuity(): GeomAbs_Shape;
  NbIntervals(S: GeomAbs_Shape): Graphic3d_ZLayerId;
  Intervals(T: IntTools_CArray1OfReal, S: GeomAbs_Shape): void;
  Trim(First: Standard_Real, Last: Standard_Real, Tol: Standard_Real): Handle_Adaptor3d_Curve;
  IsClosed(): Standard_Boolean;
  IsPeriodic(): Standard_Boolean;
  Period(): Standard_Real;
  Value(U: Standard_Real): gp_Pnt;
  D0(U: Standard_Real, P: gp_Pnt): void;
  D1(U: Standard_Real, P: gp_Pnt, V: gp_Vec): void;
  D2(U: Standard_Real, P: gp_Pnt, V1: gp_Vec, V2: gp_Vec): void;
  D3(U: Standard_Real, P: gp_Pnt, V1: gp_Vec, V2: gp_Vec, V3: gp_Vec): void;
  DN(U: Standard_Real, N: Graphic3d_ZLayerId): gp_Vec;
  Resolution(R3d: Standard_Real): Standard_Real;
  GetType(): GeomAbs_CurveType;
  Line(): gp_Lin;
  Circle(): gp_Circ;
  Ellipse(): gp_Elips;
  Hyperbola(): gp_Hypr;
  Parabola(): gp_Parab;
  Degree(): Graphic3d_ZLayerId;
  IsRational(): Standard_Boolean;
  NbPoles(): Graphic3d_ZLayerId;
  NbKnots(): Graphic3d_ZLayerId;
  Bezier(): Handle_Geom_BezierCurve;
  BSpline(): Handle_Geom_BSplineCurve;
  OffsetCurve(): Handle_Geom_OffsetCurve;
  delete(): void;
}

  export declare class BRepAdaptor_Curve_1 extends BRepAdaptor_Curve {
    constructor();
  }

  export declare class BRepAdaptor_Curve_2 extends BRepAdaptor_Curve {
    constructor(E: TopoDS_Edge);
  }

  export declare class BRepAdaptor_Curve_3 extends BRepAdaptor_Curve {
    constructor(E: TopoDS_Edge, F: TopoDS_Face);
  }

export declare class Handle_Standard_Transient {
  Nullify(): void;
  IsNull(): boolean;
  reset(thePtr: Standard_Transient): void;
  get(): Standard_Transient;
  delete(): void;
}

  export declare class Handle_Standard_Transient_1 extends Handle_Standard_Transient {
    constructor();
  }

  export declare class Handle_Standard_Transient_2 extends Handle_Standard_Transient {
    constructor(thePtr: Standard_Transient);
  }

  export declare class Handle_Standard_Transient_3 extends Handle_Standard_Transient {
    constructor(theHandle: Handle_Standard_Transient);
  }

  export declare class Handle_Standard_Transient_4 extends Handle_Standard_Transient {
    constructor(theHandle: Handle_Standard_Transient);
  }

export declare class Standard_Transient {
  Delete(): void;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  IsInstance_1(theType: Handle_Standard_Type): Standard_Boolean;
  IsInstance_2(theTypeName: Standard_CString): Standard_Boolean;
  IsKind_1(theType: Handle_Standard_Type): Standard_Boolean;
  IsKind_2(theTypeName: Standard_CString): Standard_Boolean;
  This(): Standard_Transient;
  GetRefCount(): Graphic3d_ZLayerId;
  IncrementRefCounter(): void;
  DecrementRefCounter(): Graphic3d_ZLayerId;
  delete(): void;
}

  export declare class Standard_Transient_1 extends Standard_Transient {
    constructor();
  }

  export declare class Standard_Transient_2 extends Standard_Transient {
    constructor(a: Standard_Transient);
  }

export declare class BRepGProp {
  constructor();
  static LinearProperties(S: TopoDS_Shape, LProps: GProp_GProps, SkipShared: Standard_Boolean, UseTriangulation: Standard_Boolean): void;
  static SurfaceProperties_1(S: TopoDS_Shape, SProps: GProp_GProps, SkipShared: Standard_Boolean, UseTriangulation: Standard_Boolean): void;
  static SurfaceProperties_2(S: TopoDS_Shape, SProps: GProp_GProps, Eps: Standard_Real, SkipShared: Standard_Boolean): Standard_Real;
  static VolumeProperties_1(S: TopoDS_Shape, VProps: GProp_GProps, OnlyClosed: Standard_Boolean, SkipShared: Standard_Boolean, UseTriangulation: Standard_Boolean): void;
  static VolumeProperties_2(S: TopoDS_Shape, VProps: GProp_GProps, Eps: Standard_Real, OnlyClosed: Standard_Boolean, SkipShared: Standard_Boolean): Standard_Real;
  static VolumePropertiesGK_1(S: TopoDS_Shape, VProps: GProp_GProps, Eps: Standard_Real, OnlyClosed: Standard_Boolean, IsUseSpan: Standard_Boolean, CGFlag: Standard_Boolean, IFlag: Standard_Boolean, SkipShared: Standard_Boolean): Standard_Real;
  static VolumePropertiesGK_2(S: TopoDS_Shape, VProps: GProp_GProps, thePln: gp_Pln, Eps: Standard_Real, OnlyClosed: Standard_Boolean, IsUseSpan: Standard_Boolean, CGFlag: Standard_Boolean, IFlag: Standard_Boolean, SkipShared: Standard_Boolean): Standard_Real;
  delete(): void;
}

export declare class Message_ProgressRange {
  UserBreak(): Standard_Boolean;
  More(): Standard_Boolean;
  IsActive(): Standard_Boolean;
  Close(): void;
  delete(): void;
}

  export declare class Message_ProgressRange_1 extends Message_ProgressRange {
    constructor();
  }

  export declare class Message_ProgressRange_2 extends Message_ProgressRange {
    constructor(theOther: Message_ProgressRange);
  }

export declare class BRepAlgoAPI_Algo extends BRepBuilderAPI_MakeShape {
  Shape(): TopoDS_Shape;
  Clear(): void;
  SetRunParallel(theFlag: Standard_Boolean): void;
  RunParallel(): Standard_Boolean;
  SetFuzzyValue(theFuzz: Standard_Real): void;
  FuzzyValue(): Standard_Real;
  HasErrors(): Standard_Boolean;
  HasWarnings(): Standard_Boolean;
  HasError(theType: Handle_Standard_Type): Standard_Boolean;
  HasWarning(theType: Handle_Standard_Type): Standard_Boolean;
  DumpErrors(theOS: Standard_OStream): void;
  DumpWarnings(theOS: Standard_OStream): void;
  ClearWarnings(): void;
  GetReport(): Handle_Message_Report;
  SetUseOBB(theUseOBB: Standard_Boolean): void;
  delete(): void;
}

export declare class BRepAlgoAPI_Fuse extends BRepAlgoAPI_BooleanOperation {
  delete(): void;
}

  export declare class BRepAlgoAPI_Fuse_1 extends BRepAlgoAPI_Fuse {
    constructor();
  }

  export declare class BRepAlgoAPI_Fuse_2 extends BRepAlgoAPI_Fuse {
    constructor(PF: BOPAlgo_PaveFiller);
  }

  export declare class BRepAlgoAPI_Fuse_3 extends BRepAlgoAPI_Fuse {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, theRange: Message_ProgressRange);
  }

  export declare class BRepAlgoAPI_Fuse_4 extends BRepAlgoAPI_Fuse {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, aDSF: BOPAlgo_PaveFiller, theRange: Message_ProgressRange);
  }

export declare class BRepAlgoAPI_BooleanOperation extends BRepAlgoAPI_BuilderAlgo {
  Shape1(): TopoDS_Shape;
  Shape2(): TopoDS_Shape;
  SetTools(theLS: TopTools_ListOfShape): void;
  Tools(): TopTools_ListOfShape;
  SetOperation(theBOP: BOPAlgo_Operation): void;
  Operation(): BOPAlgo_Operation;
  Build(theRange: Message_ProgressRange): void;
  delete(): void;
}

  export declare class BRepAlgoAPI_BooleanOperation_1 extends BRepAlgoAPI_BooleanOperation {
    constructor();
  }

  export declare class BRepAlgoAPI_BooleanOperation_2 extends BRepAlgoAPI_BooleanOperation {
    constructor(thePF: BOPAlgo_PaveFiller);
  }

export declare class BRepAlgoAPI_Cut extends BRepAlgoAPI_BooleanOperation {
  delete(): void;
}

  export declare class BRepAlgoAPI_Cut_1 extends BRepAlgoAPI_Cut {
    constructor();
  }

  export declare class BRepAlgoAPI_Cut_2 extends BRepAlgoAPI_Cut {
    constructor(PF: BOPAlgo_PaveFiller);
  }

  export declare class BRepAlgoAPI_Cut_3 extends BRepAlgoAPI_Cut {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, theRange: Message_ProgressRange);
  }

  export declare class BRepAlgoAPI_Cut_4 extends BRepAlgoAPI_Cut {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, aDSF: BOPAlgo_PaveFiller, bFWD: Standard_Boolean, theRange: Message_ProgressRange);
  }

export declare class BRepAlgoAPI_BuilderAlgo extends BRepAlgoAPI_Algo {
  SetArguments(theLS: TopTools_ListOfShape): void;
  Arguments(): TopTools_ListOfShape;
  SetNonDestructive(theFlag: Standard_Boolean): void;
  NonDestructive(): Standard_Boolean;
  SetGlue(theGlue: BOPAlgo_GlueEnum): void;
  Glue(): BOPAlgo_GlueEnum;
  SetCheckInverted(theCheck: Standard_Boolean): void;
  CheckInverted(): Standard_Boolean;
  Build(theRange: Message_ProgressRange): void;
  SimplifyResult(theUnifyEdges: Standard_Boolean, theUnifyFaces: Standard_Boolean, theAngularTol: Standard_Real): void;
  Modified(theS: TopoDS_Shape): TopTools_ListOfShape;
  Generated(theS: TopoDS_Shape): TopTools_ListOfShape;
  IsDeleted(aS: TopoDS_Shape): Standard_Boolean;
  HasModified(): Standard_Boolean;
  HasGenerated(): Standard_Boolean;
  HasDeleted(): Standard_Boolean;
  SetToFillHistory(theHistFlag: Standard_Boolean): void;
  HasHistory(): Standard_Boolean;
  SectionEdges(): TopTools_ListOfShape;
  DSFiller(): BOPAlgo_PPaveFiller;
  Builder(): BOPAlgo_PBuilder;
  History(): Handle_BRepTools_History;
  delete(): void;
}

  export declare class BRepAlgoAPI_BuilderAlgo_1 extends BRepAlgoAPI_BuilderAlgo {
    constructor();
  }

  export declare class BRepAlgoAPI_BuilderAlgo_2 extends BRepAlgoAPI_BuilderAlgo {
    constructor(thePF: BOPAlgo_PaveFiller);
  }

export declare class BRepAlgoAPI_Common extends BRepAlgoAPI_BooleanOperation {
  delete(): void;
}

  export declare class BRepAlgoAPI_Common_1 extends BRepAlgoAPI_Common {
    constructor();
  }

  export declare class BRepAlgoAPI_Common_2 extends BRepAlgoAPI_Common {
    constructor(PF: BOPAlgo_PaveFiller);
  }

  export declare class BRepAlgoAPI_Common_3 extends BRepAlgoAPI_Common {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, theRange: Message_ProgressRange);
  }

  export declare class BRepAlgoAPI_Common_4 extends BRepAlgoAPI_Common {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, PF: BOPAlgo_PaveFiller, theRange: Message_ProgressRange);
  }

export declare class BRepAlgoAPI_Section extends BRepAlgoAPI_BooleanOperation {
  Init1_1(S1: TopoDS_Shape): void;
  Init1_2(Pl: gp_Pln): void;
  Init1_3(Sf: Handle_Geom_Surface): void;
  Init2_1(S2: TopoDS_Shape): void;
  Init2_2(Pl: gp_Pln): void;
  Init2_3(Sf: Handle_Geom_Surface): void;
  Approximation(B: Standard_Boolean): void;
  ComputePCurveOn1(B: Standard_Boolean): void;
  ComputePCurveOn2(B: Standard_Boolean): void;
  Build(theRange: Message_ProgressRange): void;
  HasAncestorFaceOn1(E: TopoDS_Shape, F: TopoDS_Shape): Standard_Boolean;
  HasAncestorFaceOn2(E: TopoDS_Shape, F: TopoDS_Shape): Standard_Boolean;
  delete(): void;
}

  export declare class BRepAlgoAPI_Section_1 extends BRepAlgoAPI_Section {
    constructor();
  }

  export declare class BRepAlgoAPI_Section_2 extends BRepAlgoAPI_Section {
    constructor(PF: BOPAlgo_PaveFiller);
  }

  export declare class BRepAlgoAPI_Section_3 extends BRepAlgoAPI_Section {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, PerformNow: Standard_Boolean);
  }

  export declare class BRepAlgoAPI_Section_4 extends BRepAlgoAPI_Section {
    constructor(S1: TopoDS_Shape, S2: TopoDS_Shape, aDSF: BOPAlgo_PaveFiller, PerformNow: Standard_Boolean);
  }

  export declare class BRepAlgoAPI_Section_5 extends BRepAlgoAPI_Section {
    constructor(S1: TopoDS_Shape, Pl: gp_Pln, PerformNow: Standard_Boolean);
  }

  export declare class BRepAlgoAPI_Section_6 extends BRepAlgoAPI_Section {
    constructor(S1: TopoDS_Shape, Sf: Handle_Geom_Surface, PerformNow: Standard_Boolean);
  }

  export declare class BRepAlgoAPI_Section_7 extends BRepAlgoAPI_Section {
    constructor(Sf: Handle_Geom_Surface, S2: TopoDS_Shape, PerformNow: Standard_Boolean);
  }

  export declare class BRepAlgoAPI_Section_8 extends BRepAlgoAPI_Section {
    constructor(Sf1: Handle_Geom_Surface, Sf2: Handle_Geom_Surface, PerformNow: Standard_Boolean);
  }

export declare type ChFi3d_FilletShape = {
  ChFi3d_Rational: {};
  ChFi3d_QuasiAngular: {};
  ChFi3d_Polynomial: {};
}

export declare type TopAbs_ShapeEnum = {
  TopAbs_COMPOUND: {};
  TopAbs_COMPSOLID: {};
  TopAbs_SOLID: {};
  TopAbs_SHELL: {};
  TopAbs_FACE: {};
  TopAbs_WIRE: {};
  TopAbs_EDGE: {};
  TopAbs_VERTEX: {};
  TopAbs_SHAPE: {};
}

export declare type TopAbs_Orientation = {
  TopAbs_FORWARD: {};
  TopAbs_REVERSED: {};
  TopAbs_INTERNAL: {};
  TopAbs_EXTERNAL: {};
}

export declare class BRep_Builder extends TopoDS_Builder {
  constructor();
  MakeFace_1(F: TopoDS_Face): void;
  MakeFace_2(F: TopoDS_Face, S: Handle_Geom_Surface, Tol: Standard_Real): void;
  MakeFace_3(F: TopoDS_Face, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real): void;
  MakeFace_4(theFace: TopoDS_Face, theTriangulation: Handle_Poly_Triangulation): void;
  MakeFace_5(theFace: TopoDS_Face, theTriangulations: Poly_ListOfTriangulation, theActiveTriangulation: Handle_Poly_Triangulation): void;
  UpdateFace_1(F: TopoDS_Face, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real): void;
  UpdateFace_2(theFace: TopoDS_Face, theTriangulation: Handle_Poly_Triangulation, theToReset: Standard_Boolean): void;
  UpdateFace_3(F: TopoDS_Face, Tol: Standard_Real): void;
  NaturalRestriction(F: TopoDS_Face, N: Standard_Boolean): void;
  MakeEdge_1(E: TopoDS_Edge): void;
  MakeEdge_2(E: TopoDS_Edge, C: Handle_Geom_Curve, Tol: Standard_Real): void;
  MakeEdge_3(E: TopoDS_Edge, C: Handle_Geom_Curve, L: TopLoc_Location, Tol: Standard_Real): void;
  MakeEdge_4(E: TopoDS_Edge, P: Handle_Poly_Polygon3D): void;
  MakeEdge_5(E: TopoDS_Edge, N: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation): void;
  MakeEdge_6(E: TopoDS_Edge, N: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation, L: TopLoc_Location): void;
  UpdateEdge_1(E: TopoDS_Edge, C: Handle_Geom_Curve, Tol: Standard_Real): void;
  UpdateEdge_2(E: TopoDS_Edge, C: Handle_Geom_Curve, L: TopLoc_Location, Tol: Standard_Real): void;
  UpdateEdge_3(E: TopoDS_Edge, C: Handle_Geom2d_Curve, F: TopoDS_Face, Tol: Standard_Real): void;
  UpdateEdge_4(E: TopoDS_Edge, C1: Handle_Geom2d_Curve, C2: Handle_Geom2d_Curve, F: TopoDS_Face, Tol: Standard_Real): void;
  UpdateEdge_5(E: TopoDS_Edge, C: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real): void;
  UpdateEdge_6(E: TopoDS_Edge, C: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real, Pf: gp_Pnt2d, Pl: gp_Pnt2d): void;
  UpdateEdge_7(E: TopoDS_Edge, C1: Handle_Geom2d_Curve, C2: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real): void;
  UpdateEdge_8(E: TopoDS_Edge, C1: Handle_Geom2d_Curve, C2: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real, Pf: gp_Pnt2d, Pl: gp_Pnt2d): void;
  UpdateEdge_9(E: TopoDS_Edge, P: Handle_Poly_Polygon3D): void;
  UpdateEdge_10(E: TopoDS_Edge, P: Handle_Poly_Polygon3D, L: TopLoc_Location): void;
  UpdateEdge_11(E: TopoDS_Edge, N: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation): void;
  UpdateEdge_12(E: TopoDS_Edge, N: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation, L: TopLoc_Location): void;
  UpdateEdge_13(E: TopoDS_Edge, N1: Handle_Poly_PolygonOnTriangulation, N2: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation): void;
  UpdateEdge_14(E: TopoDS_Edge, N1: Handle_Poly_PolygonOnTriangulation, N2: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation, L: TopLoc_Location): void;
  UpdateEdge_15(E: TopoDS_Edge, P: Handle_Poly_Polygon2D, S: TopoDS_Face): void;
  UpdateEdge_16(E: TopoDS_Edge, P: Handle_Poly_Polygon2D, S: Handle_Geom_Surface, T: TopLoc_Location): void;
  UpdateEdge_17(E: TopoDS_Edge, P1: Handle_Poly_Polygon2D, P2: Handle_Poly_Polygon2D, S: TopoDS_Face): void;
  UpdateEdge_18(E: TopoDS_Edge, P1: Handle_Poly_Polygon2D, P2: Handle_Poly_Polygon2D, S: Handle_Geom_Surface, L: TopLoc_Location): void;
  UpdateEdge_19(E: TopoDS_Edge, Tol: Standard_Real): void;
  Continuity_1(E: TopoDS_Edge, F1: TopoDS_Face, F2: TopoDS_Face, C: GeomAbs_Shape): void;
  Continuity_2(E: TopoDS_Edge, S1: Handle_Geom_Surface, S2: Handle_Geom_Surface, L1: TopLoc_Location, L2: TopLoc_Location, C: GeomAbs_Shape): void;
  SameParameter(E: TopoDS_Edge, S: Standard_Boolean): void;
  SameRange(E: TopoDS_Edge, S: Standard_Boolean): void;
  Degenerated(E: TopoDS_Edge, D: Standard_Boolean): void;
  Range_1(E: TopoDS_Edge, First: Standard_Real, Last: Standard_Real, Only3d: Standard_Boolean): void;
  Range_2(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real): void;
  Range_3(E: TopoDS_Edge, F: TopoDS_Face, First: Standard_Real, Last: Standard_Real): void;
  Transfert_1(Ein: TopoDS_Edge, Eout: TopoDS_Edge): void;
  MakeVertex_1(V: TopoDS_Vertex): void;
  MakeVertex_2(V: TopoDS_Vertex, P: gp_Pnt, Tol: Standard_Real): void;
  UpdateVertex_1(V: TopoDS_Vertex, P: gp_Pnt, Tol: Standard_Real): void;
  UpdateVertex_2(V: TopoDS_Vertex, P: Standard_Real, E: TopoDS_Edge, Tol: Standard_Real): void;
  UpdateVertex_3(V: TopoDS_Vertex, P: Standard_Real, E: TopoDS_Edge, F: TopoDS_Face, Tol: Standard_Real): void;
  UpdateVertex_4(V: TopoDS_Vertex, P: Standard_Real, E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, Tol: Standard_Real): void;
  UpdateVertex_5(Ve: TopoDS_Vertex, U: Standard_Real, V: Standard_Real, F: TopoDS_Face, Tol: Standard_Real): void;
  UpdateVertex_6(V: TopoDS_Vertex, Tol: Standard_Real): void;
  Transfert_2(Ein: TopoDS_Edge, Eout: TopoDS_Edge, Vin: TopoDS_Vertex, Vout: TopoDS_Vertex): void;
  delete(): void;
}

export declare class BRep_Tool {
  constructor();
  static IsClosed_1(S: TopoDS_Shape): Standard_Boolean;
  static Surface_1(F: TopoDS_Face, L: TopLoc_Location): Handle_Geom_Surface;
  static Surface_2(F: TopoDS_Face): Handle_Geom_Surface;
  static Triangulation(theFace: TopoDS_Face, theLocation: TopLoc_Location, theMeshPurpose: Poly_MeshPurpose): Handle_Poly_Triangulation;
  static Triangulations(theFace: TopoDS_Face, theLocation: TopLoc_Location): Poly_ListOfTriangulation;
  static Tolerance_1(F: TopoDS_Face): Standard_Real;
  static NaturalRestriction(F: TopoDS_Face): Standard_Boolean;
  static IsGeometric_1(F: TopoDS_Face): Standard_Boolean;
  static IsGeometric_2(E: TopoDS_Edge): Standard_Boolean;
  static Curve_1(E: TopoDS_Edge, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real): Handle_Geom_Curve;
  static Curve_2(E: TopoDS_Edge, First: Standard_Real, Last: Standard_Real): Handle_Geom_Curve;
  static Polygon3D(E: TopoDS_Edge, L: TopLoc_Location): Handle_Poly_Polygon3D;
  static CurveOnSurface_1(E: TopoDS_Edge, F: TopoDS_Face, First: Standard_Real, Last: Standard_Real, theIsStored: Standard_Boolean): Handle_Geom2d_Curve;
  static CurveOnSurface_2(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real, theIsStored: Standard_Boolean): Handle_Geom2d_Curve;
  static CurveOnPlane(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real): Handle_Geom2d_Curve;
  static CurveOnSurface_3(E: TopoDS_Edge, C: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real): void;
  static CurveOnSurface_4(E: TopoDS_Edge, C: Handle_Geom2d_Curve, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real, Index: Graphic3d_ZLayerId): void;
  static PolygonOnSurface_1(E: TopoDS_Edge, F: TopoDS_Face): Handle_Poly_Polygon2D;
  static PolygonOnSurface_2(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location): Handle_Poly_Polygon2D;
  static PolygonOnSurface_3(E: TopoDS_Edge, C: Handle_Poly_Polygon2D, S: Handle_Geom_Surface, L: TopLoc_Location): void;
  static PolygonOnSurface_4(E: TopoDS_Edge, C: Handle_Poly_Polygon2D, S: Handle_Geom_Surface, L: TopLoc_Location, Index: Graphic3d_ZLayerId): void;
  static PolygonOnTriangulation_1(E: TopoDS_Edge, T: Handle_Poly_Triangulation, L: TopLoc_Location): Handle_Poly_PolygonOnTriangulation;
  static PolygonOnTriangulation_2(E: TopoDS_Edge, P: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation, L: TopLoc_Location): void;
  static PolygonOnTriangulation_3(E: TopoDS_Edge, P: Handle_Poly_PolygonOnTriangulation, T: Handle_Poly_Triangulation, L: TopLoc_Location, Index: Graphic3d_ZLayerId): void;
  static IsClosed_2(E: TopoDS_Edge, F: TopoDS_Face): Standard_Boolean;
  static IsClosed_3(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location): Standard_Boolean;
  static IsClosed_4(E: TopoDS_Edge, T: Handle_Poly_Triangulation, L: TopLoc_Location): Standard_Boolean;
  static Tolerance_2(E: TopoDS_Edge): Standard_Real;
  static SameParameter(E: TopoDS_Edge): Standard_Boolean;
  static SameRange(E: TopoDS_Edge): Standard_Boolean;
  static Degenerated(E: TopoDS_Edge): Standard_Boolean;
  static Range_1(E: TopoDS_Edge, First: Standard_Real, Last: Standard_Real): void;
  static Range_2(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, First: Standard_Real, Last: Standard_Real): void;
  static Range_3(E: TopoDS_Edge, F: TopoDS_Face, First: Standard_Real, Last: Standard_Real): void;
  static UVPoints_1(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, PFirst: gp_Pnt2d, PLast: gp_Pnt2d): void;
  static UVPoints_2(E: TopoDS_Edge, F: TopoDS_Face, PFirst: gp_Pnt2d, PLast: gp_Pnt2d): void;
  static SetUVPoints_1(E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location, PFirst: gp_Pnt2d, PLast: gp_Pnt2d): void;
  static SetUVPoints_2(E: TopoDS_Edge, F: TopoDS_Face, PFirst: gp_Pnt2d, PLast: gp_Pnt2d): void;
  static HasContinuity_1(E: TopoDS_Edge, F1: TopoDS_Face, F2: TopoDS_Face): Standard_Boolean;
  static Continuity_1(E: TopoDS_Edge, F1: TopoDS_Face, F2: TopoDS_Face): GeomAbs_Shape;
  static HasContinuity_2(E: TopoDS_Edge, S1: Handle_Geom_Surface, S2: Handle_Geom_Surface, L1: TopLoc_Location, L2: TopLoc_Location): Standard_Boolean;
  static Continuity_2(E: TopoDS_Edge, S1: Handle_Geom_Surface, S2: Handle_Geom_Surface, L1: TopLoc_Location, L2: TopLoc_Location): GeomAbs_Shape;
  static HasContinuity_3(E: TopoDS_Edge): Standard_Boolean;
  static MaxContinuity(theEdge: TopoDS_Edge): GeomAbs_Shape;
  static Pnt(V: TopoDS_Vertex): gp_Pnt;
  static Tolerance_3(V: TopoDS_Vertex): Standard_Real;
  static Parameter_1(theV: TopoDS_Vertex, theE: TopoDS_Edge, theParam: Standard_Real): Standard_Boolean;
  static Parameter_2(V: TopoDS_Vertex, E: TopoDS_Edge): Standard_Real;
  static Parameter_3(V: TopoDS_Vertex, E: TopoDS_Edge, F: TopoDS_Face): Standard_Real;
  static Parameter_4(V: TopoDS_Vertex, E: TopoDS_Edge, S: Handle_Geom_Surface, L: TopLoc_Location): Standard_Real;
  static Parameters(V: TopoDS_Vertex, F: TopoDS_Face): gp_Pnt2d;
  static MaxTolerance(theShape: TopoDS_Shape, theSubShape: TopAbs_ShapeEnum): Standard_Real;
  delete(): void;
}

export declare class HLRBRep_InternalAlgo extends Standard_Transient {
  Projector_1(P: HLRAlgo_Projector): void;
  Projector_2(): HLRAlgo_Projector;
  Update(): void;
  Load_1(S: Handle_HLRTopoBRep_OutLiner, SData: Handle_Standard_Transient, nbIso: Graphic3d_ZLayerId): void;
  Load_2(S: Handle_HLRTopoBRep_OutLiner, nbIso: Graphic3d_ZLayerId): void;
  Index(S: Handle_HLRTopoBRep_OutLiner): Graphic3d_ZLayerId;
  Remove(I: Graphic3d_ZLayerId): void;
  ShapeData(I: Graphic3d_ZLayerId, SData: Handle_Standard_Transient): void;
  SeqOfShapeBounds(): HLRBRep_SeqOfShapeBounds;
  NbShapes(): Graphic3d_ZLayerId;
  ShapeBounds(I: Graphic3d_ZLayerId): HLRBRep_ShapeBounds;
  InitEdgeStatus(): void;
  Select_1(): void;
  Select_2(I: Graphic3d_ZLayerId): void;
  SelectEdge(I: Graphic3d_ZLayerId): void;
  SelectFace(I: Graphic3d_ZLayerId): void;
  ShowAll_1(): void;
  ShowAll_2(I: Graphic3d_ZLayerId): void;
  HideAll_1(): void;
  HideAll_2(I: Graphic3d_ZLayerId): void;
  PartialHide(): void;
  Hide_1(): void;
  Hide_2(I: Graphic3d_ZLayerId): void;
  Hide_3(I: Graphic3d_ZLayerId, J: Graphic3d_ZLayerId): void;
  Debug_1(deb: Standard_Boolean): void;
  Debug_2(): Standard_Boolean;
  DataStructure(): Handle_HLRBRep_Data;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  delete(): void;
}

  export declare class HLRBRep_InternalAlgo_1 extends HLRBRep_InternalAlgo {
    constructor();
  }

  export declare class HLRBRep_InternalAlgo_2 extends HLRBRep_InternalAlgo {
    constructor(A: Handle_HLRBRep_InternalAlgo);
  }

export declare class Handle_HLRBRep_PolyAlgo {
  Nullify(): void;
  IsNull(): boolean;
  reset(thePtr: HLRBRep_PolyAlgo): void;
  get(): HLRBRep_PolyAlgo;
  delete(): void;
}

  export declare class Handle_HLRBRep_PolyAlgo_1 extends Handle_HLRBRep_PolyAlgo {
    constructor();
  }

  export declare class Handle_HLRBRep_PolyAlgo_2 extends Handle_HLRBRep_PolyAlgo {
    constructor(thePtr: HLRBRep_PolyAlgo);
  }

  export declare class Handle_HLRBRep_PolyAlgo_3 extends Handle_HLRBRep_PolyAlgo {
    constructor(theHandle: Handle_HLRBRep_PolyAlgo);
  }

  export declare class Handle_HLRBRep_PolyAlgo_4 extends Handle_HLRBRep_PolyAlgo {
    constructor(theHandle: Handle_HLRBRep_PolyAlgo);
  }

export declare class HLRBRep_PolyAlgo extends Standard_Transient {
  NbShapes(): Graphic3d_ZLayerId;
  Shape(I: Graphic3d_ZLayerId): TopoDS_Shape;
  Remove(I: Graphic3d_ZLayerId): void;
  Index(S: TopoDS_Shape): Graphic3d_ZLayerId;
  Load(theShape: TopoDS_Shape): void;
  Algo(): Handle_HLRAlgo_PolyAlgo;
  Projector_1(): HLRAlgo_Projector;
  Projector_2(theProj: HLRAlgo_Projector): void;
  TolAngular_1(): Standard_Real;
  TolAngular_2(theTol: Standard_Real): void;
  TolCoef_1(): Standard_Real;
  TolCoef_2(theTol: Standard_Real): void;
  Update(): void;
  InitHide(): void;
  MoreHide(): Standard_Boolean;
  NextHide(): void;
  Hide(status: HLRAlgo_EdgeStatus, S: TopoDS_Shape, reg1: Standard_Boolean, regn: Standard_Boolean, outl: Standard_Boolean, intl: Standard_Boolean): any;
  InitShow(): void;
  MoreShow(): Standard_Boolean;
  NextShow(): void;
  Show(S: TopoDS_Shape, reg1: Standard_Boolean, regn: Standard_Boolean, outl: Standard_Boolean, intl: Standard_Boolean): any;
  OutLinedShape(S: TopoDS_Shape): TopoDS_Shape;
  Debug_1(): Standard_Boolean;
  Debug_2(theDebug: Standard_Boolean): void;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  delete(): void;
}

  export declare class HLRBRep_PolyAlgo_1 extends HLRBRep_PolyAlgo {
    constructor();
  }

  export declare class HLRBRep_PolyAlgo_2 extends HLRBRep_PolyAlgo {
    constructor(A: Handle_HLRBRep_PolyAlgo);
  }

  export declare class HLRBRep_PolyAlgo_3 extends HLRBRep_PolyAlgo {
    constructor(S: TopoDS_Shape);
  }

export declare class HLRBRep_PolyHLRToShape {
  constructor()
  Update(A: Handle_HLRBRep_PolyAlgo): void;
  Show(): void;
  Hide(): void;
  VCompound_1(): TopoDS_Shape;
  VCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  Rg1LineVCompound_1(): TopoDS_Shape;
  Rg1LineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  RgNLineVCompound_1(): TopoDS_Shape;
  RgNLineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  OutLineVCompound_1(): TopoDS_Shape;
  OutLineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  HCompound_1(): TopoDS_Shape;
  HCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  Rg1LineHCompound_1(): TopoDS_Shape;
  Rg1LineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  RgNLineHCompound_1(): TopoDS_Shape;
  RgNLineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  OutLineHCompound_1(): TopoDS_Shape;
  OutLineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  delete(): void;
}

export declare class Handle_HLRBRep_Algo {
  Nullify(): void;
  IsNull(): boolean;
  reset(thePtr: HLRBRep_Algo): void;
  get(): HLRBRep_Algo;
  delete(): void;
}

  export declare class Handle_HLRBRep_Algo_1 extends Handle_HLRBRep_Algo {
    constructor();
  }

  export declare class Handle_HLRBRep_Algo_2 extends Handle_HLRBRep_Algo {
    constructor(thePtr: HLRBRep_Algo);
  }

  export declare class Handle_HLRBRep_Algo_3 extends Handle_HLRBRep_Algo {
    constructor(theHandle: Handle_HLRBRep_Algo);
  }

  export declare class Handle_HLRBRep_Algo_4 extends Handle_HLRBRep_Algo {
    constructor(theHandle: Handle_HLRBRep_Algo);
  }

export declare class HLRBRep_Algo extends HLRBRep_InternalAlgo {
  Add_1(S: TopoDS_Shape, SData: Handle_Standard_Transient, nbIso: Graphic3d_ZLayerId): void;
  Add_2(S: TopoDS_Shape, nbIso: Graphic3d_ZLayerId): void;
  Index(S: TopoDS_Shape): Graphic3d_ZLayerId;
  OutLinedShapeNullify(): void;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  delete(): void;
}

  export declare class HLRBRep_Algo_1 extends HLRBRep_Algo {
    constructor();
  }

  export declare class HLRBRep_Algo_2 extends HLRBRep_Algo {
    constructor(A: Handle_HLRBRep_Algo);
  }

export declare type HLRBRep_TypeOfResultingEdge = {
  HLRBRep_Undefined: {};
  HLRBRep_IsoLine: {};
  HLRBRep_OutLine: {};
  HLRBRep_Rg1Line: {};
  HLRBRep_RgNLine: {};
  HLRBRep_Sharp: {};
}

export declare class HLRBRep_HLRToShape {
  constructor(A: Handle_HLRBRep_Algo)
  VCompound_1(): TopoDS_Shape;
  VCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  Rg1LineVCompound_1(): TopoDS_Shape;
  Rg1LineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  RgNLineVCompound_1(): TopoDS_Shape;
  RgNLineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  OutLineVCompound_1(): TopoDS_Shape;
  OutLineVCompound3d(): TopoDS_Shape;
  OutLineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  IsoLineVCompound_1(): TopoDS_Shape;
  IsoLineVCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  HCompound_1(): TopoDS_Shape;
  HCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  Rg1LineHCompound_1(): TopoDS_Shape;
  Rg1LineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  RgNLineHCompound_1(): TopoDS_Shape;
  RgNLineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  OutLineHCompound_1(): TopoDS_Shape;
  OutLineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  IsoLineHCompound_1(): TopoDS_Shape;
  IsoLineHCompound_2(S: TopoDS_Shape): TopoDS_Shape;
  CompoundOfEdges_1(type: HLRBRep_TypeOfResultingEdge, visible: Standard_Boolean, In3d: Standard_Boolean): TopoDS_Shape;
  CompoundOfEdges_2(S: TopoDS_Shape, type: HLRBRep_TypeOfResultingEdge, visible: Standard_Boolean, In3d: Standard_Boolean): TopoDS_Shape;
  delete(): void;
}

export declare class BRepBuilderAPI_Command {
  IsDone(): Standard_Boolean;
  Check(): void;
  delete(): void;
}

export declare class BRepBuilderAPI_MakeShape extends BRepBuilderAPI_Command {
  Build(theRange: Message_ProgressRange): void;
  Shape(): TopoDS_Shape;
  Generated(S: TopoDS_Shape): TopTools_ListOfShape;
  Modified(S: TopoDS_Shape): TopTools_ListOfShape;
  IsDeleted(S: TopoDS_Shape): Standard_Boolean;
  delete(): void;
}

export declare class BRepBuilderAPI_ModifyShape extends BRepBuilderAPI_MakeShape {
  Modified(S: TopoDS_Shape): TopTools_ListOfShape;
  ModifiedShape(S: TopoDS_Shape): TopoDS_Shape;
  delete(): void;
}

export declare class BRepBuilderAPI_MakeFace extends BRepBuilderAPI_MakeShape {
  Init_1(F: TopoDS_Face): void;
  Init_2(S: Handle_Geom_Surface, Bound: Standard_Boolean, TolDegen: Standard_Real): void;
  Init_3(S: Handle_Geom_Surface, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real, TolDegen: Standard_Real): void;
  Add(W: TopoDS_Wire): void;
  IsDone(): Standard_Boolean;
  Error(): BRepBuilderAPI_FaceError;
  Face(): TopoDS_Face;
  delete(): void;
}

  export declare class BRepBuilderAPI_MakeFace_1 extends BRepBuilderAPI_MakeFace {
    constructor();
  }

  export declare class BRepBuilderAPI_MakeFace_2 extends BRepBuilderAPI_MakeFace {
    constructor(F: TopoDS_Face);
  }

  export declare class BRepBuilderAPI_MakeFace_3 extends BRepBuilderAPI_MakeFace {
    constructor(P: gp_Pln);
  }

  export declare class BRepBuilderAPI_MakeFace_4 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cylinder);
  }

  export declare class BRepBuilderAPI_MakeFace_5 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cone);
  }

  export declare class BRepBuilderAPI_MakeFace_6 extends BRepBuilderAPI_MakeFace {
    constructor(S: gp_Sphere);
  }

  export declare class BRepBuilderAPI_MakeFace_7 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Torus);
  }

  export declare class BRepBuilderAPI_MakeFace_8 extends BRepBuilderAPI_MakeFace {
    constructor(S: Handle_Geom_Surface, TolDegen: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_9 extends BRepBuilderAPI_MakeFace {
    constructor(P: gp_Pln, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_10 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cylinder, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_11 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cone, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_12 extends BRepBuilderAPI_MakeFace {
    constructor(S: gp_Sphere, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_13 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Torus, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_14 extends BRepBuilderAPI_MakeFace {
    constructor(S: Handle_Geom_Surface, UMin: Standard_Real, UMax: Standard_Real, VMin: Standard_Real, VMax: Standard_Real, TolDegen: Standard_Real);
  }

  export declare class BRepBuilderAPI_MakeFace_15 extends BRepBuilderAPI_MakeFace {
    constructor(W: TopoDS_Wire, OnlyPlane: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_16 extends BRepBuilderAPI_MakeFace {
    constructor(P: gp_Pln, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_17 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cylinder, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_18 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Cone, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_19 extends BRepBuilderAPI_MakeFace {
    constructor(S: gp_Sphere, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_20 extends BRepBuilderAPI_MakeFace {
    constructor(C: gp_Torus, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_21 extends BRepBuilderAPI_MakeFace {
    constructor(S: Handle_Geom_Surface, W: TopoDS_Wire, Inside: Standard_Boolean);
  }

  export declare class BRepBuilderAPI_MakeFace_22 extends BRepBuilderAPI_MakeFace {
    constructor(F: TopoDS_Face, W: TopoDS_Wire);
  }

export declare class BRepBuilderAPI_Transform extends BRepBuilderAPI_ModifyShape {
  Perform(S: TopoDS_Shape, Copy: Standard_Boolean): void;
  ModifiedShape(S: TopoDS_Shape): TopoDS_Shape;
  Modified(S: TopoDS_Shape): TopTools_ListOfShape;
  delete(): void;
}

  export declare class BRepBuilderAPI_Transform_1 extends BRepBuilderAPI_Transform {
    constructor(T: gp_Trsf);
  }

  export declare class BRepBuilderAPI_Transform_2 extends BRepBuilderAPI_Transform {
    constructor(S: TopoDS_Shape, T: gp_Trsf, Copy: Standard_Boolean);
  }

export declare class GCPnts_TangentialDeflection {
  Initialize_1(theC: Adaptor3d_Curve, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real): void;
  Initialize_2(theC: Adaptor3d_Curve, theFirstParameter: Standard_Real, theLastParameter: Standard_Real, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real): void;
  Initialize_3(theC: Adaptor2d_Curve2d, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real): void;
  Initialize_4(theC: Adaptor2d_Curve2d, theFirstParameter: Standard_Real, theLastParameter: Standard_Real, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real): void;
  AddPoint(thePnt: gp_Pnt, theParam: Standard_Real, theIsReplace: Standard_Boolean): Graphic3d_ZLayerId;
  NbPoints(): Graphic3d_ZLayerId;
  Parameter(I: Graphic3d_ZLayerId): Standard_Real;
  Value(I: Graphic3d_ZLayerId): gp_Pnt;
  static ArcAngularStep(theRadius: Standard_Real, theLinearDeflection: Standard_Real, theAngularDeflection: Standard_Real, theMinLength: Standard_Real): Standard_Real;
  delete(): void;
}

  export declare class GCPnts_TangentialDeflection_1 extends GCPnts_TangentialDeflection {
    constructor();
  }

  export declare class GCPnts_TangentialDeflection_2 extends GCPnts_TangentialDeflection {
    constructor(theC: Adaptor3d_Curve, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real);
  }

  export declare class GCPnts_TangentialDeflection_3 extends GCPnts_TangentialDeflection {
    constructor(theC: Adaptor3d_Curve, theFirstParameter: Standard_Real, theLastParameter: Standard_Real, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real);
  }

  export declare class GCPnts_TangentialDeflection_4 extends GCPnts_TangentialDeflection {
    constructor(theC: Adaptor2d_Curve2d, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real);
  }

  export declare class GCPnts_TangentialDeflection_5 extends GCPnts_TangentialDeflection {
    constructor(theC: Adaptor2d_Curve2d, theFirstParameter: Standard_Real, theLastParameter: Standard_Real, theAngularDeflection: Standard_Real, theCurvatureDeflection: Standard_Real, theMinimumOfPoints: Graphic3d_ZLayerId, theUTol: Standard_Real, theMinLen: Standard_Real);
  }

export declare class GCPnts_QuasiUniformDeflection {
  Initialize_1(theC: Adaptor3d_Curve, theDeflection: Standard_Real, theContinuity: GeomAbs_Shape): void;
  Initialize_2(theC: Adaptor2d_Curve2d, theDeflection: Standard_Real, theContinuity: GeomAbs_Shape): void;
  Initialize_3(theC: Adaptor3d_Curve, theDeflection: Standard_Real, theU1: Standard_Real, theU2: Standard_Real, theContinuity: GeomAbs_Shape): void;
  Initialize_4(theC: Adaptor2d_Curve2d, theDeflection: Standard_Real, theU1: Standard_Real, theU2: Standard_Real, theContinuity: GeomAbs_Shape): void;
  IsDone(): Standard_Boolean;
  NbPoints(): Graphic3d_ZLayerId;
  Parameter(Index: Graphic3d_ZLayerId): Standard_Real;
  Value(Index: Graphic3d_ZLayerId): gp_Pnt;
  Deflection(): Standard_Real;
  delete(): void;
}

  export declare class GCPnts_QuasiUniformDeflection_1 extends GCPnts_QuasiUniformDeflection {
    constructor();
  }

  export declare class GCPnts_QuasiUniformDeflection_2 extends GCPnts_QuasiUniformDeflection {
    constructor(theC: Adaptor3d_Curve, theDeflection: Standard_Real, theContinuity: GeomAbs_Shape);
  }

  export declare class GCPnts_QuasiUniformDeflection_3 extends GCPnts_QuasiUniformDeflection {
    constructor(theC: Adaptor2d_Curve2d, theDeflection: Standard_Real, theContinuity: GeomAbs_Shape);
  }

  export declare class GCPnts_QuasiUniformDeflection_4 extends GCPnts_QuasiUniformDeflection {
    constructor(theC: Adaptor3d_Curve, theDeflection: Standard_Real, theU1: Standard_Real, theU2: Standard_Real, theContinuity: GeomAbs_Shape);
  }

  export declare class GCPnts_QuasiUniformDeflection_5 extends GCPnts_QuasiUniformDeflection {
    constructor(theC: Adaptor2d_Curve2d, theDeflection: Standard_Real, theU1: Standard_Real, theU2: Standard_Real, theContinuity: GeomAbs_Shape);
  }

export declare class BRepFilletAPI_MakeChamfer extends BRepFilletAPI_LocalOperation {
  constructor(S: TopoDS_Shape)
  Add_1(E: TopoDS_Edge): void;
  Add_2(Dis: Standard_Real, E: TopoDS_Edge): void;
  SetDist(Dis: Standard_Real, IC: Graphic3d_ZLayerId, F: TopoDS_Face): void;
  GetDist(IC: Graphic3d_ZLayerId, Dis: Standard_Real): void;
  Add_3(Dis1: Standard_Real, Dis2: Standard_Real, E: TopoDS_Edge, F: TopoDS_Face): void;
  SetDists(Dis1: Standard_Real, Dis2: Standard_Real, IC: Graphic3d_ZLayerId, F: TopoDS_Face): void;
  Dists(IC: Graphic3d_ZLayerId, Dis1: Standard_Real, Dis2: Standard_Real): void;
  AddDA(Dis: Standard_Real, Angle: Standard_Real, E: TopoDS_Edge, F: TopoDS_Face): void;
  SetDistAngle(Dis: Standard_Real, Angle: Standard_Real, IC: Graphic3d_ZLayerId, F: TopoDS_Face): void;
  GetDistAngle(IC: Graphic3d_ZLayerId, Dis: Standard_Real, Angle: Standard_Real): void;
  SetMode(theMode: ChFiDS_ChamfMode): void;
  IsSymetric(IC: Graphic3d_ZLayerId): Standard_Boolean;
  IsTwoDistances(IC: Graphic3d_ZLayerId): Standard_Boolean;
  IsDistanceAngle(IC: Graphic3d_ZLayerId): Standard_Boolean;
  ResetContour(IC: Graphic3d_ZLayerId): void;
  NbContours(): Graphic3d_ZLayerId;
  Contour(E: TopoDS_Edge): Graphic3d_ZLayerId;
  NbEdges(I: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Edge(I: Graphic3d_ZLayerId, J: Graphic3d_ZLayerId): TopoDS_Edge;
  Remove(E: TopoDS_Edge): void;
  Length(IC: Graphic3d_ZLayerId): Standard_Real;
  FirstVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  LastVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  Abscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  RelativeAbscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  ClosedAndTangent(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Closed(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Build(theRange: Message_ProgressRange): void;
  Reset(): void;
  Builder(): Handle_TopOpeBRepBuild_HBuilder;
  Generated(EorV: TopoDS_Shape): TopTools_ListOfShape;
  Modified(F: TopoDS_Shape): TopTools_ListOfShape;
  IsDeleted(F: TopoDS_Shape): Standard_Boolean;
  Simulate(IC: Graphic3d_ZLayerId): void;
  NbSurf(IC: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Sect(IC: Graphic3d_ZLayerId, IS: Graphic3d_ZLayerId): Handle_ChFiDS_SecHArray1;
  delete(): void;
}

export declare class BRepFilletAPI_MakeFillet extends BRepFilletAPI_LocalOperation {
  constructor(S: TopoDS_Shape, FShape: ChFi3d_FilletShape)
  SetParams(Tang: Standard_Real, Tesp: Standard_Real, T2d: Standard_Real, TApp3d: Standard_Real, TolApp2d: Standard_Real, Fleche: Standard_Real): void;
  SetContinuity(InternalContinuity: GeomAbs_Shape, AngularTolerance: Standard_Real): void;
  Add_1(E: TopoDS_Edge): void;
  Add_2(Radius: Standard_Real, E: TopoDS_Edge): void;
  Add_3(R1: Standard_Real, R2: Standard_Real, E: TopoDS_Edge): void;
  Add_4(L: Handle_Law_Function, E: TopoDS_Edge): void;
  Add_5(UandR: TColgp_Array1OfPnt2d, E: TopoDS_Edge): void;
  SetRadius_1(Radius: Standard_Real, IC: Graphic3d_ZLayerId, IinC: Graphic3d_ZLayerId): void;
  SetRadius_2(R1: Standard_Real, R2: Standard_Real, IC: Graphic3d_ZLayerId, IinC: Graphic3d_ZLayerId): void;
  SetRadius_3(L: Handle_Law_Function, IC: Graphic3d_ZLayerId, IinC: Graphic3d_ZLayerId): void;
  SetRadius_4(UandR: TColgp_Array1OfPnt2d, IC: Graphic3d_ZLayerId, IinC: Graphic3d_ZLayerId): void;
  ResetContour(IC: Graphic3d_ZLayerId): void;
  IsConstant_1(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Radius_1(IC: Graphic3d_ZLayerId): Standard_Real;
  IsConstant_2(IC: Graphic3d_ZLayerId, E: TopoDS_Edge): Standard_Boolean;
  Radius_2(IC: Graphic3d_ZLayerId, E: TopoDS_Edge): Standard_Real;
  SetRadius_5(Radius: Standard_Real, IC: Graphic3d_ZLayerId, E: TopoDS_Edge): void;
  SetRadius_6(Radius: Standard_Real, IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): void;
  GetBounds(IC: Graphic3d_ZLayerId, E: TopoDS_Edge, F: Standard_Real, L: Standard_Real): Standard_Boolean;
  GetLaw(IC: Graphic3d_ZLayerId, E: TopoDS_Edge): Handle_Law_Function;
  SetLaw(IC: Graphic3d_ZLayerId, E: TopoDS_Edge, L: Handle_Law_Function): void;
  SetFilletShape(FShape: ChFi3d_FilletShape): void;
  GetFilletShape(): ChFi3d_FilletShape;
  NbContours(): Graphic3d_ZLayerId;
  Contour(E: TopoDS_Edge): Graphic3d_ZLayerId;
  NbEdges(I: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Edge(I: Graphic3d_ZLayerId, J: Graphic3d_ZLayerId): TopoDS_Edge;
  Remove(E: TopoDS_Edge): void;
  Length(IC: Graphic3d_ZLayerId): Standard_Real;
  FirstVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  LastVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  Abscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  RelativeAbscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  ClosedAndTangent(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Closed(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Build(theRange: Message_ProgressRange): void;
  Reset(): void;
  Builder(): Handle_TopOpeBRepBuild_HBuilder;
  Generated(EorV: TopoDS_Shape): TopTools_ListOfShape;
  Modified(F: TopoDS_Shape): TopTools_ListOfShape;
  IsDeleted(F: TopoDS_Shape): Standard_Boolean;
  NbSurfaces(): Graphic3d_ZLayerId;
  NewFaces(I: Graphic3d_ZLayerId): TopTools_ListOfShape;
  Simulate(IC: Graphic3d_ZLayerId): void;
  NbSurf(IC: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Sect(IC: Graphic3d_ZLayerId, IS: Graphic3d_ZLayerId): Handle_ChFiDS_SecHArray1;
  NbFaultyContours(): Graphic3d_ZLayerId;
  FaultyContour(I: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  NbComputedSurfaces(IC: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  ComputedSurface(IC: Graphic3d_ZLayerId, IS: Graphic3d_ZLayerId): Handle_Geom_Surface;
  NbFaultyVertices(): Graphic3d_ZLayerId;
  FaultyVertex(IV: Graphic3d_ZLayerId): TopoDS_Vertex;
  HasResult(): Standard_Boolean;
  BadShape(): TopoDS_Shape;
  StripeStatus(IC: Graphic3d_ZLayerId): ChFiDS_ErrorStatus;
  delete(): void;
}

export declare class BRepFilletAPI_LocalOperation extends BRepBuilderAPI_MakeShape {
  Add(E: TopoDS_Edge): void;
  ResetContour(IC: Graphic3d_ZLayerId): void;
  NbContours(): Graphic3d_ZLayerId;
  Contour(E: TopoDS_Edge): Graphic3d_ZLayerId;
  NbEdges(I: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Edge(I: Graphic3d_ZLayerId, J: Graphic3d_ZLayerId): TopoDS_Edge;
  Remove(E: TopoDS_Edge): void;
  Length(IC: Graphic3d_ZLayerId): Standard_Real;
  FirstVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  LastVertex(IC: Graphic3d_ZLayerId): TopoDS_Vertex;
  Abscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  RelativeAbscissa(IC: Graphic3d_ZLayerId, V: TopoDS_Vertex): Standard_Real;
  ClosedAndTangent(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Closed(IC: Graphic3d_ZLayerId): Standard_Boolean;
  Reset(): void;
  Simulate(IC: Graphic3d_ZLayerId): void;
  NbSurf(IC: Graphic3d_ZLayerId): Graphic3d_ZLayerId;
  Sect(IC: Graphic3d_ZLayerId, IS: Graphic3d_ZLayerId): Handle_ChFiDS_SecHArray1;
  delete(): void;
}

export declare class HLRAlgo_Projector {
  Set(T: gp_Trsf, Persp: Standard_Boolean, Focus: Standard_Real): void;
  Directions(D1: gp_Vec2d, D2: gp_Vec2d, D3: gp_Vec2d): void;
  Scaled(On: Standard_Boolean): void;
  Perspective(): Standard_Boolean;
  Transformation(): gp_Trsf;
  InvertedTransformation(): gp_Trsf;
  FullTransformation(): gp_Trsf;
  Focus(): Standard_Real;
  Transform_1(D: gp_Vec): void;
  Transform_2(Pnt: gp_Pnt): void;
  Project_1(P: gp_Pnt, Pout: gp_Pnt2d): void;
  Project_2(P: gp_Pnt, X: Standard_Real, Y: Standard_Real, Z: Standard_Real): void;
  Project_3(P: gp_Pnt, D1: gp_Vec, Pout: gp_Pnt2d, D1out: gp_Vec2d): void;
  Shoot(X: Standard_Real, Y: Standard_Real): gp_Lin;
  delete(): void;
}

  export declare class HLRAlgo_Projector_1 extends HLRAlgo_Projector {
    constructor();
  }

  export declare class HLRAlgo_Projector_2 extends HLRAlgo_Projector {
    constructor(CS: gp_Ax2);
  }

  export declare class HLRAlgo_Projector_3 extends HLRAlgo_Projector {
    constructor(CS: gp_Ax2, Focus: Standard_Real);
  }

  export declare class HLRAlgo_Projector_4 extends HLRAlgo_Projector {
    constructor(T: gp_Trsf, Persp: Standard_Boolean, Focus: Standard_Real);
  }

  export declare class HLRAlgo_Projector_5 extends HLRAlgo_Projector {
    constructor(T: gp_Trsf, Persp: Standard_Boolean, Focus: Standard_Real, v1: gp_Vec2d, v2: gp_Vec2d, v3: gp_Vec2d);
  }

export declare class BRepMesh_IncrementalMesh extends BRepMesh_DiscretRoot {
  Perform_1(theRange: Message_ProgressRange): void;
  Perform_2(theContext: any, theRange: Message_ProgressRange): void;
  Parameters(): IMeshTools_Parameters;
  ChangeParameters(): IMeshTools_Parameters;
  IsModified(): Standard_Boolean;
  GetStatusFlags(): Graphic3d_ZLayerId;
  static Discret(theShape: TopoDS_Shape, theLinDeflection: Standard_Real, theAngDeflection: Standard_Real, theAlgo: BRepMesh_DiscretRoot): Graphic3d_ZLayerId;
  static IsParallelDefault(): Standard_Boolean;
  static SetParallelDefault(isInParallel: Standard_Boolean): void;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  delete(): void;
}

  export declare class BRepMesh_IncrementalMesh_1 extends BRepMesh_IncrementalMesh {
    constructor();
  }

  export declare class BRepMesh_IncrementalMesh_2 extends BRepMesh_IncrementalMesh {
    constructor(theShape: TopoDS_Shape, theLinDeflection: Standard_Real, isRelative: Standard_Boolean, theAngDeflection: Standard_Real, isInParallel: Standard_Boolean);
  }

  export declare class BRepMesh_IncrementalMesh_3 extends BRepMesh_IncrementalMesh {
    constructor(theShape: TopoDS_Shape, theParameters: IMeshTools_Parameters, theRange: Message_ProgressRange);
  }

export declare class BRepMesh_DiscretRoot extends Standard_Transient {
  SetShape(theShape: TopoDS_Shape): void;
  Shape(): TopoDS_Shape;
  IsDone(): Standard_Boolean;
  Perform(theRange: Message_ProgressRange): void;
  static get_type_name(): Standard_Character;
  static get_type_descriptor(): Handle_Standard_Type;
  DynamicType(): Handle_Standard_Type;
  delete(): void;
}

type Standard_Boolean = boolean;
type Standard_Byte = number;
type Standard_Character = number;
type Standard_CString = string;
type Standard_Integer = number;
type Standard_Real = number;
type Standard_ShortReal = number;
type Standard_Size = number;

declare namespace FS {
  interface Lookup {
      path: string;
      node: FSNode;
  }

  interface FSStream {}
  interface FSNode {}
  interface ErrnoError {}

  let ignorePermissions: boolean;
  let trackingDelegate: any;
  let tracking: any;
  let genericErrors: any;

  //
  // paths
  //
  function lookupPath(path: string, opts: any): Lookup;
  function getPath(node: FSNode): string;

  //
  // nodes
  //
  function isFile(mode: number): boolean;
  function isDir(mode: number): boolean;
  function isLink(mode: number): boolean;
  function isChrdev(mode: number): boolean;
  function isBlkdev(mode: number): boolean;
  function isFIFO(mode: number): boolean;
  function isSocket(mode: number): boolean;

  //
  // devices
  //
  function major(dev: number): number;
  function minor(dev: number): number;
  function makedev(ma: number, mi: number): number;
  function registerDevice(dev: number, ops: any): void;

  //
  // core
  //
  function syncfs(populate: boolean, callback: (e: any) => any): void;
  function syncfs(callback: (e: any) => any, populate?: boolean): void;
  function mount(type: any, opts: any, mountpoint: string): any;
  function unmount(mountpoint: string): void;

  function mkdir(path: string, mode?: number): any;
  function mkdev(path: string, mode?: number, dev?: number): any;
  function symlink(oldpath: string, newpath: string): any;
  function rename(old_path: string, new_path: string): void;
  function rmdir(path: string): void;
  function readdir(path: string): any;
  function unlink(path: string): void;
  function readlink(path: string): string;
  function stat(path: string, dontFollow?: boolean): any;
  function lstat(path: string): any;
  function chmod(path: string, mode: number, dontFollow?: boolean): void;
  function lchmod(path: string, mode: number): void;
  function fchmod(fd: number, mode: number): void;
  function chown(path: string, uid: number, gid: number, dontFollow?: boolean): void;
  function lchown(path: string, uid: number, gid: number): void;
  function fchown(fd: number, uid: number, gid: number): void;
  function truncate(path: string, len: number): void;
  function ftruncate(fd: number, len: number): void;
  function utime(path: string, atime: number, mtime: number): void;
  function open(path: string, flags: string, mode?: number, fd_start?: number, fd_end?: number): FSStream;
  function close(stream: FSStream): void;
  function llseek(stream: FSStream, offset: number, whence: number): any;
  function read(stream: FSStream, buffer: ArrayBufferView, offset: number, length: number, position?: number): number;
  function write(
      stream: FSStream,
      buffer: ArrayBufferView,
      offset: number,
      length: number,
      position?: number,
      canOwn?: boolean,
  ): number;
  function allocate(stream: FSStream, offset: number, length: number): void;
  function mmap(
      stream: FSStream,
      buffer: ArrayBufferView,
      offset: number,
      length: number,
      position: number,
      prot: number,
      flags: number,
  ): any;
  function ioctl(stream: FSStream, cmd: any, arg: any): any;
  function readFile(path: string, opts: { encoding: 'binary'; flags?: string }): Uint8Array;
  function readFile(path: string, opts: { encoding: 'utf8'; flags?: string }): string;
  function readFile(path: string, opts?: { flags?: string }): Uint8Array;
  function writeFile(path: string, data: string | ArrayBufferView, opts?: { flags?: string }): void;

  //
  // module-level FS code
  //
  function cwd(): string;
  function chdir(path: string): void;
  function init(
      input: null | (() => number | null),
      output: null | ((c: number) => any),
      error: null | ((c: number) => any),
  ): void;

  function createLazyFile(
      parent: string | FSNode,
      name: string,
      url: string,
      canRead: boolean,
      canWrite: boolean,
  ): FSNode;
  function createPreloadedFile(
      parent: string | FSNode,
      name: string,
      url: string,
      canRead: boolean,
      canWrite: boolean,
      onload?: () => void,
      onerror?: () => void,
      dontCreateFile?: boolean,
      canOwn?: boolean,
  ): void;
  function createDataFile(
      parent: string | FSNode,
      name: string,
      data: ArrayBufferView | string,
      canRead: boolean,
      canWrite: boolean,
      canOwn: boolean,
  ): FSNode;
  interface AnalysisResults {
    isRoot: boolean,
    exists: boolean,
    error: Error,
    name: string,
    path: any,
    object: any,
    parentExists: boolean,
    parentPath: any,
    parentObject: any
  }
  function analyzePath(path: string): AnalysisResults;
}


export type OpenCascadeInstance = {FS: typeof FS} & {
  Handle_Poly_Triangulation: typeof Handle_Poly_Triangulation;
  Handle_Poly_Triangulation_1: typeof Handle_Poly_Triangulation_1;
  Handle_Poly_Triangulation_2: typeof Handle_Poly_Triangulation_2;
  Handle_Poly_Triangulation_3: typeof Handle_Poly_Triangulation_3;
  Handle_Poly_Triangulation_4: typeof Handle_Poly_Triangulation_4;
  Poly_Triangulation: typeof Poly_Triangulation;
  Poly_Triangulation_1: typeof Poly_Triangulation_1;
  Poly_Triangulation_2: typeof Poly_Triangulation_2;
  Poly_Triangulation_3: typeof Poly_Triangulation_3;
  Poly_Triangulation_4: typeof Poly_Triangulation_4;
  Poly_Triangulation_5: typeof Poly_Triangulation_5;
  Poly_Array1OfTriangle: typeof Poly_Array1OfTriangle;
  Poly_Array1OfTriangle_1: typeof Poly_Array1OfTriangle_1;
  Poly_Array1OfTriangle_2: typeof Poly_Array1OfTriangle_2;
  Poly_Array1OfTriangle_3: typeof Poly_Array1OfTriangle_3;
  Poly_Array1OfTriangle_4: typeof Poly_Array1OfTriangle_4;
  Poly_Array1OfTriangle_5: typeof Poly_Array1OfTriangle_5;
  Poly_Triangle: typeof Poly_Triangle;
  Poly_Triangle_1: typeof Poly_Triangle_1;
  Poly_Triangle_2: typeof Poly_Triangle_2;
  TopoDS_Builder: typeof TopoDS_Builder;
  TopoDS: typeof TopoDS;
  TopoDS_Face: typeof TopoDS_Face;
  TopoDS_Compound: typeof TopoDS_Compound;
  TopoDS_Edge: typeof TopoDS_Edge;
  TopoDS_Shape: typeof TopoDS_Shape;
  TopLoc_Location: typeof TopLoc_Location;
  TopLoc_Location_1: typeof TopLoc_Location_1;
  TopLoc_Location_2: typeof TopLoc_Location_2;
  TopLoc_Location_3: typeof TopLoc_Location_3;
  TColgp_Array1OfPnt: typeof TColgp_Array1OfPnt;
  TColgp_Array1OfPnt_1: typeof TColgp_Array1OfPnt_1;
  TColgp_Array1OfPnt_2: typeof TColgp_Array1OfPnt_2;
  TColgp_Array1OfPnt_3: typeof TColgp_Array1OfPnt_3;
  TColgp_Array1OfPnt_4: typeof TColgp_Array1OfPnt_4;
  TColgp_Array1OfPnt_5: typeof TColgp_Array1OfPnt_5;
  NCollection_BaseList: typeof NCollection_BaseList;
  NCollection_BaseMap: typeof NCollection_BaseMap;
  TopExp_Explorer: typeof TopExp_Explorer;
  TopExp_Explorer_1: typeof TopExp_Explorer_1;
  TopExp_Explorer_2: typeof TopExp_Explorer_2;
  TopExp: typeof TopExp;
  GProp_GProps: typeof GProp_GProps;
  GProp_GProps_1: typeof GProp_GProps_1;
  GProp_GProps_2: typeof GProp_GProps_2;
  BRepPrimAPI_MakeOneAxis: typeof BRepPrimAPI_MakeOneAxis;
  BRepPrimAPI_MakeBox: typeof BRepPrimAPI_MakeBox;
  BRepPrimAPI_MakeBox_1: typeof BRepPrimAPI_MakeBox_1;
  BRepPrimAPI_MakeBox_2: typeof BRepPrimAPI_MakeBox_2;
  BRepPrimAPI_MakeBox_3: typeof BRepPrimAPI_MakeBox_3;
  BRepPrimAPI_MakeBox_4: typeof BRepPrimAPI_MakeBox_4;
  BRepPrimAPI_MakeBox_5: typeof BRepPrimAPI_MakeBox_5;
  BRepPrimAPI_MakeSweep: typeof BRepPrimAPI_MakeSweep;
  BRepPrimAPI_MakeHalfSpace: typeof BRepPrimAPI_MakeHalfSpace;
  BRepPrimAPI_MakeHalfSpace_1: typeof BRepPrimAPI_MakeHalfSpace_1;
  BRepPrimAPI_MakeHalfSpace_2: typeof BRepPrimAPI_MakeHalfSpace_2;
  BRepPrimAPI_MakeCylinder: typeof BRepPrimAPI_MakeCylinder;
  BRepPrimAPI_MakeCylinder_1: typeof BRepPrimAPI_MakeCylinder_1;
  BRepPrimAPI_MakeCylinder_2: typeof BRepPrimAPI_MakeCylinder_2;
  BRepPrimAPI_MakeCylinder_3: typeof BRepPrimAPI_MakeCylinder_3;
  BRepPrimAPI_MakeCylinder_4: typeof BRepPrimAPI_MakeCylinder_4;
  gp_Trsf: typeof gp_Trsf;
  gp_Trsf_1: typeof gp_Trsf_1;
  gp_Trsf_2: typeof gp_Trsf_2;
  gp_Vec: typeof gp_Vec;
  gp_Vec_1: typeof gp_Vec_1;
  gp_Vec_2: typeof gp_Vec_2;
  gp_Vec_3: typeof gp_Vec_3;
  gp_Vec_4: typeof gp_Vec_4;
  gp_Vec_5: typeof gp_Vec_5;
  gp_Ax3: typeof gp_Ax3;
  gp_Ax3_1: typeof gp_Ax3_1;
  gp_Ax3_2: typeof gp_Ax3_2;
  gp_Ax3_3: typeof gp_Ax3_3;
  gp_Ax3_4: typeof gp_Ax3_4;
  gp_Ax1: typeof gp_Ax1;
  gp_Ax1_1: typeof gp_Ax1_1;
  gp_Ax1_2: typeof gp_Ax1_2;
  gp_Pln: typeof gp_Pln;
  gp_Pln_1: typeof gp_Pln_1;
  gp_Pln_2: typeof gp_Pln_2;
  gp_Pln_3: typeof gp_Pln_3;
  gp_Pln_4: typeof gp_Pln_4;
  gp_Ax2: typeof gp_Ax2;
  gp_Ax2_1: typeof gp_Ax2_1;
  gp_Ax2_2: typeof gp_Ax2_2;
  gp_Ax2_3: typeof gp_Ax2_3;
  gp_Pnt: typeof gp_Pnt;
  gp_Pnt_1: typeof gp_Pnt_1;
  gp_Pnt_2: typeof gp_Pnt_2;
  gp_Pnt_3: typeof gp_Pnt_3;
  gp_Dir: typeof gp_Dir;
  gp_Dir_1: typeof gp_Dir_1;
  gp_Dir_2: typeof gp_Dir_2;
  gp_Dir_3: typeof gp_Dir_3;
  gp_Dir_4: typeof gp_Dir_4;
  Adaptor3d_Curve: typeof Adaptor3d_Curve;
  TopTools_ListOfShape: typeof TopTools_ListOfShape;
  TopTools_ListOfShape_1: typeof TopTools_ListOfShape_1;
  TopTools_ListOfShape_2: typeof TopTools_ListOfShape_2;
  TopTools_ListOfShape_3: typeof TopTools_ListOfShape_3;
  TopTools_IndexedDataMapOfShapeListOfShape: typeof TopTools_IndexedDataMapOfShapeListOfShape;
  TopTools_IndexedDataMapOfShapeListOfShape_1: typeof TopTools_IndexedDataMapOfShapeListOfShape_1;
  TopTools_IndexedDataMapOfShapeListOfShape_2: typeof TopTools_IndexedDataMapOfShapeListOfShape_2;
  TopTools_IndexedDataMapOfShapeListOfShape_3: typeof TopTools_IndexedDataMapOfShapeListOfShape_3;
  TopTools_IndexedMapOfShape: typeof TopTools_IndexedMapOfShape;
  TopTools_IndexedMapOfShape_1: typeof TopTools_IndexedMapOfShape_1;
  TopTools_IndexedMapOfShape_2: typeof TopTools_IndexedMapOfShape_2;
  TopTools_IndexedMapOfShape_3: typeof TopTools_IndexedMapOfShape_3;
  GeomAbs_Shape: GeomAbs_Shape;
  Handle_BRepAdaptor_Curve: typeof Handle_BRepAdaptor_Curve;
  Handle_BRepAdaptor_Curve_1: typeof Handle_BRepAdaptor_Curve_1;
  Handle_BRepAdaptor_Curve_2: typeof Handle_BRepAdaptor_Curve_2;
  Handle_BRepAdaptor_Curve_3: typeof Handle_BRepAdaptor_Curve_3;
  Handle_BRepAdaptor_Curve_4: typeof Handle_BRepAdaptor_Curve_4;
  BRepAdaptor_Curve: typeof BRepAdaptor_Curve;
  BRepAdaptor_Curve_1: typeof BRepAdaptor_Curve_1;
  BRepAdaptor_Curve_2: typeof BRepAdaptor_Curve_2;
  BRepAdaptor_Curve_3: typeof BRepAdaptor_Curve_3;
  Handle_Standard_Transient: typeof Handle_Standard_Transient;
  Handle_Standard_Transient_1: typeof Handle_Standard_Transient_1;
  Handle_Standard_Transient_2: typeof Handle_Standard_Transient_2;
  Handle_Standard_Transient_3: typeof Handle_Standard_Transient_3;
  Handle_Standard_Transient_4: typeof Handle_Standard_Transient_4;
  Standard_Transient: typeof Standard_Transient;
  Standard_Transient_1: typeof Standard_Transient_1;
  Standard_Transient_2: typeof Standard_Transient_2;
  BRepGProp: typeof BRepGProp;
  Message_ProgressRange: typeof Message_ProgressRange;
  Message_ProgressRange_1: typeof Message_ProgressRange_1;
  Message_ProgressRange_2: typeof Message_ProgressRange_2;
  BRepAlgoAPI_Algo: typeof BRepAlgoAPI_Algo;
  BRepAlgoAPI_Fuse: typeof BRepAlgoAPI_Fuse;
  BRepAlgoAPI_Fuse_1: typeof BRepAlgoAPI_Fuse_1;
  BRepAlgoAPI_Fuse_2: typeof BRepAlgoAPI_Fuse_2;
  BRepAlgoAPI_Fuse_3: typeof BRepAlgoAPI_Fuse_3;
  BRepAlgoAPI_Fuse_4: typeof BRepAlgoAPI_Fuse_4;
  BRepAlgoAPI_BooleanOperation: typeof BRepAlgoAPI_BooleanOperation;
  BRepAlgoAPI_BooleanOperation_1: typeof BRepAlgoAPI_BooleanOperation_1;
  BRepAlgoAPI_BooleanOperation_2: typeof BRepAlgoAPI_BooleanOperation_2;
  BRepAlgoAPI_Cut: typeof BRepAlgoAPI_Cut;
  BRepAlgoAPI_Cut_1: typeof BRepAlgoAPI_Cut_1;
  BRepAlgoAPI_Cut_2: typeof BRepAlgoAPI_Cut_2;
  BRepAlgoAPI_Cut_3: typeof BRepAlgoAPI_Cut_3;
  BRepAlgoAPI_Cut_4: typeof BRepAlgoAPI_Cut_4;
  BRepAlgoAPI_BuilderAlgo: typeof BRepAlgoAPI_BuilderAlgo;
  BRepAlgoAPI_BuilderAlgo_1: typeof BRepAlgoAPI_BuilderAlgo_1;
  BRepAlgoAPI_BuilderAlgo_2: typeof BRepAlgoAPI_BuilderAlgo_2;
  BRepAlgoAPI_Common: typeof BRepAlgoAPI_Common;
  BRepAlgoAPI_Common_1: typeof BRepAlgoAPI_Common_1;
  BRepAlgoAPI_Common_2: typeof BRepAlgoAPI_Common_2;
  BRepAlgoAPI_Common_3: typeof BRepAlgoAPI_Common_3;
  BRepAlgoAPI_Common_4: typeof BRepAlgoAPI_Common_4;
  BRepAlgoAPI_Section: typeof BRepAlgoAPI_Section;
  BRepAlgoAPI_Section_1: typeof BRepAlgoAPI_Section_1;
  BRepAlgoAPI_Section_2: typeof BRepAlgoAPI_Section_2;
  BRepAlgoAPI_Section_3: typeof BRepAlgoAPI_Section_3;
  BRepAlgoAPI_Section_4: typeof BRepAlgoAPI_Section_4;
  BRepAlgoAPI_Section_5: typeof BRepAlgoAPI_Section_5;
  BRepAlgoAPI_Section_6: typeof BRepAlgoAPI_Section_6;
  BRepAlgoAPI_Section_7: typeof BRepAlgoAPI_Section_7;
  BRepAlgoAPI_Section_8: typeof BRepAlgoAPI_Section_8;
  ChFi3d_FilletShape: ChFi3d_FilletShape;
  TopAbs_ShapeEnum: TopAbs_ShapeEnum;
  TopAbs_Orientation: TopAbs_Orientation;
  BRep_Builder: typeof BRep_Builder;
  BRep_Tool: typeof BRep_Tool;
  HLRBRep_InternalAlgo: typeof HLRBRep_InternalAlgo;
  HLRBRep_InternalAlgo_1: typeof HLRBRep_InternalAlgo_1;
  HLRBRep_InternalAlgo_2: typeof HLRBRep_InternalAlgo_2;
  Handle_HLRBRep_PolyAlgo: typeof Handle_HLRBRep_PolyAlgo;
  Handle_HLRBRep_PolyAlgo_1: typeof Handle_HLRBRep_PolyAlgo_1;
  Handle_HLRBRep_PolyAlgo_2: typeof Handle_HLRBRep_PolyAlgo_2;
  Handle_HLRBRep_PolyAlgo_3: typeof Handle_HLRBRep_PolyAlgo_3;
  Handle_HLRBRep_PolyAlgo_4: typeof Handle_HLRBRep_PolyAlgo_4;
  HLRBRep_PolyAlgo: typeof HLRBRep_PolyAlgo;
  HLRBRep_PolyAlgo_1: typeof HLRBRep_PolyAlgo_1;
  HLRBRep_PolyAlgo_2: typeof HLRBRep_PolyAlgo_2;
  HLRBRep_PolyAlgo_3: typeof HLRBRep_PolyAlgo_3;
  HLRBRep_PolyHLRToShape: typeof HLRBRep_PolyHLRToShape;
  Handle_HLRBRep_Algo: typeof Handle_HLRBRep_Algo;
  Handle_HLRBRep_Algo_1: typeof Handle_HLRBRep_Algo_1;
  Handle_HLRBRep_Algo_2: typeof Handle_HLRBRep_Algo_2;
  Handle_HLRBRep_Algo_3: typeof Handle_HLRBRep_Algo_3;
  Handle_HLRBRep_Algo_4: typeof Handle_HLRBRep_Algo_4;
  HLRBRep_Algo: typeof HLRBRep_Algo;
  HLRBRep_Algo_1: typeof HLRBRep_Algo_1;
  HLRBRep_Algo_2: typeof HLRBRep_Algo_2;
  HLRBRep_TypeOfResultingEdge: HLRBRep_TypeOfResultingEdge;
  HLRBRep_HLRToShape: typeof HLRBRep_HLRToShape;
  BRepBuilderAPI_Command: typeof BRepBuilderAPI_Command;
  BRepBuilderAPI_MakeShape: typeof BRepBuilderAPI_MakeShape;
  BRepBuilderAPI_ModifyShape: typeof BRepBuilderAPI_ModifyShape;
  BRepBuilderAPI_MakeFace: typeof BRepBuilderAPI_MakeFace;
  BRepBuilderAPI_MakeFace_1: typeof BRepBuilderAPI_MakeFace_1;
  BRepBuilderAPI_MakeFace_2: typeof BRepBuilderAPI_MakeFace_2;
  BRepBuilderAPI_MakeFace_3: typeof BRepBuilderAPI_MakeFace_3;
  BRepBuilderAPI_MakeFace_4: typeof BRepBuilderAPI_MakeFace_4;
  BRepBuilderAPI_MakeFace_5: typeof BRepBuilderAPI_MakeFace_5;
  BRepBuilderAPI_MakeFace_6: typeof BRepBuilderAPI_MakeFace_6;
  BRepBuilderAPI_MakeFace_7: typeof BRepBuilderAPI_MakeFace_7;
  BRepBuilderAPI_MakeFace_8: typeof BRepBuilderAPI_MakeFace_8;
  BRepBuilderAPI_MakeFace_9: typeof BRepBuilderAPI_MakeFace_9;
  BRepBuilderAPI_MakeFace_10: typeof BRepBuilderAPI_MakeFace_10;
  BRepBuilderAPI_MakeFace_11: typeof BRepBuilderAPI_MakeFace_11;
  BRepBuilderAPI_MakeFace_12: typeof BRepBuilderAPI_MakeFace_12;
  BRepBuilderAPI_MakeFace_13: typeof BRepBuilderAPI_MakeFace_13;
  BRepBuilderAPI_MakeFace_14: typeof BRepBuilderAPI_MakeFace_14;
  BRepBuilderAPI_MakeFace_15: typeof BRepBuilderAPI_MakeFace_15;
  BRepBuilderAPI_MakeFace_16: typeof BRepBuilderAPI_MakeFace_16;
  BRepBuilderAPI_MakeFace_17: typeof BRepBuilderAPI_MakeFace_17;
  BRepBuilderAPI_MakeFace_18: typeof BRepBuilderAPI_MakeFace_18;
  BRepBuilderAPI_MakeFace_19: typeof BRepBuilderAPI_MakeFace_19;
  BRepBuilderAPI_MakeFace_20: typeof BRepBuilderAPI_MakeFace_20;
  BRepBuilderAPI_MakeFace_21: typeof BRepBuilderAPI_MakeFace_21;
  BRepBuilderAPI_MakeFace_22: typeof BRepBuilderAPI_MakeFace_22;
  BRepBuilderAPI_Transform: typeof BRepBuilderAPI_Transform;
  BRepBuilderAPI_Transform_1: typeof BRepBuilderAPI_Transform_1;
  BRepBuilderAPI_Transform_2: typeof BRepBuilderAPI_Transform_2;
  GCPnts_TangentialDeflection: typeof GCPnts_TangentialDeflection;
  GCPnts_TangentialDeflection_1: typeof GCPnts_TangentialDeflection_1;
  GCPnts_TangentialDeflection_2: typeof GCPnts_TangentialDeflection_2;
  GCPnts_TangentialDeflection_3: typeof GCPnts_TangentialDeflection_3;
  GCPnts_TangentialDeflection_4: typeof GCPnts_TangentialDeflection_4;
  GCPnts_TangentialDeflection_5: typeof GCPnts_TangentialDeflection_5;
  GCPnts_QuasiUniformDeflection: typeof GCPnts_QuasiUniformDeflection;
  GCPnts_QuasiUniformDeflection_1: typeof GCPnts_QuasiUniformDeflection_1;
  GCPnts_QuasiUniformDeflection_2: typeof GCPnts_QuasiUniformDeflection_2;
  GCPnts_QuasiUniformDeflection_3: typeof GCPnts_QuasiUniformDeflection_3;
  GCPnts_QuasiUniformDeflection_4: typeof GCPnts_QuasiUniformDeflection_4;
  GCPnts_QuasiUniformDeflection_5: typeof GCPnts_QuasiUniformDeflection_5;
  BRepFilletAPI_MakeChamfer: typeof BRepFilletAPI_MakeChamfer;
  BRepFilletAPI_MakeFillet: typeof BRepFilletAPI_MakeFillet;
  BRepFilletAPI_LocalOperation: typeof BRepFilletAPI_LocalOperation;
  HLRAlgo_Projector: typeof HLRAlgo_Projector;
  HLRAlgo_Projector_1: typeof HLRAlgo_Projector_1;
  HLRAlgo_Projector_2: typeof HLRAlgo_Projector_2;
  HLRAlgo_Projector_3: typeof HLRAlgo_Projector_3;
  HLRAlgo_Projector_4: typeof HLRAlgo_Projector_4;
  HLRAlgo_Projector_5: typeof HLRAlgo_Projector_5;
  BRepMesh_IncrementalMesh: typeof BRepMesh_IncrementalMesh;
  BRepMesh_IncrementalMesh_1: typeof BRepMesh_IncrementalMesh_1;
  BRepMesh_IncrementalMesh_2: typeof BRepMesh_IncrementalMesh_2;
  BRepMesh_IncrementalMesh_3: typeof BRepMesh_IncrementalMesh_3;
  BRepMesh_DiscretRoot: typeof BRepMesh_DiscretRoot;
};

declare function init(): Promise<OpenCascadeInstance>;

export default init;
