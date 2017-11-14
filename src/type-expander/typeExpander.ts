import typeSystem = require("../typesystem/parse");
import tsInterfaces = typeSystem.tsInterfaces;
import defSysUtil = require("./definitionSystemUtil");
import _ = require("underscore");

export type IPropertyInfo = tsInterfaces.IPropertyInfo;
export type IParsedType = tsInterfaces.IParsedType;
export type ITypeFacet = tsInterfaces.ITypeFacet;
export type IExample = tsInterfaces.IExample;
export type IAnnotation = tsInterfaces.IAnnotation;
export type IConstraint = tsInterfaces.IConstraint;
export type ElementSourceInfo = tsInterfaces.ElementSourceInfo;

export interface BranchingData{

    branchingOption(branchId:number):number;

    typeMap():TypeMap;

    expander():TypeExpander;
}

export interface TypeMap{

    addType(t:TypeEntry):void;

    removeType(t:TypeEntry):void;

    hasType(t:TypeEntry):boolean;
}

export interface BranchingRegistry{

    nextBranchId(optionsCount:number):number;

    possibleBranches(tm?:TypeMap):BranchingData[];

    expander():TypeExpander;
}

export interface Entry{

    append(te:GeneralTypeEntry,bd:BranchingData):void;
}

export class PropertyEntry implements Entry{

    constructor(protected _original:IPropertyInfo,
                protected _name:string,
                protected _type:TypeEntry,
                protected _required:boolean,
                protected isFacet=false,
                protected _metadata:any){

    }

    name():string{
        return this._original ? this._original.name() : this._name;
    }

    append(te:GeneralTypeEntry,bd:BranchingData):void{
        let etp = new GeneralTypeEntry(this._type.original(),[],null,[], [], this._type.name());
        this._type.append(etp,bd);
        let newPropEntry = new PropertyEntry(this._original,this._name,etp,this.required(),this.isFacet,this.metadata());
        if(this.isFacet){
            te.addFacet(newPropEntry);
        }
        else {
            te.addProperty(newPropEntry);
        }
    }

    type():TypeEntry{
        return this._type;
    }

    required():boolean{
        if(this._required!=null){
            return this._required;
        }
        return this._original.required();
    }

    metadata():any{
        return this._metadata;
    }
}


export interface TypeEntry extends Entry{

    name():string;

    original():IParsedType;

    isUnion():boolean;

    isBuiltIn():boolean;

    isExternal():boolean;

    schema():string;

    isIntersection():boolean;

    addSuperType(type:TypeEntry):void;

    superTypes():TypeEntry[];

    clone():TypeEntry;

    possibleBuiltInTypes(occured:{[key:string]:boolean}):string[];

    branchingRegistry(): BranchingRegistry;

    allFacets():ITypeFacet[];

    declaredFacets():ITypeFacet[];

    isRecursionPoint():boolean;

    examples(expand:boolean):IExample[]

    meta():ITypeFacet[];

    schemaPath():string;

    id():string;
}

export class AbstractTypeEntry implements TypeEntry{


    constructor(protected _original:IParsedType,protected _superTypes:TypeEntry[]){
        this._id = ""+(globalId++);
    }

    protected _branchingRegistry:BranchingRegistry;

    private _id:string;

    id(){
        return this._id;
    }

    branchingRegistry(): BranchingRegistry {
        return this._branchingRegistry;
    }

    setBranchingRegistry(value: BranchingRegistry) {
        this._branchingRegistry = value;
    }

    name():string{
        return this._original && this._original.name();
    }

    isUnion():boolean{
        return false;
    }

    isBuiltIn():boolean{
        return false;
    }

    isExternal():boolean{
        if(this._original){
            return this._original.isExternal();
        }
        for(let st of this.superTypes()){
            if(st.isExternal()){
                return true;
            }
        }
        return false;
    }

    schema():string{
        if(this._original){
            let et = _.find([this._original].concat(this._original.allSuperTypes()),x=>
                (<IParsedType>x).kind()=="external");
            if(et) {
                return (<any>et).schema();
            }
            return null;
        }
        for(let st of this.superTypes()){
            let sch = st.schema();
            if(sch){
                return sch;
            }
        }
        return null;
    }

    isIntersection():boolean{
        return false;
    }

    addSuperType(type:TypeEntry):void{
        this._superTypes = this._superTypes || [];
        this._superTypes.push(type);
    }

    superTypes():TypeEntry[]{
        return this._superTypes;
    }

    original():IParsedType{
        return this._original;
    }

    append(te:GeneralTypeEntry,bd:BranchingData):void{
        // if(!te._original){
        //     te._original = this.original();
        // }
    }

    clone():TypeEntry{
        throw new Error("not implemented");
    }

    possibleBuiltInTypes():string[]{
        throw new Error("not implemented");
    }

    declaredFacets() {
        let result:ITypeFacet[] = [];
        if(this._original){
            result = this._original.declaredFacets();
            result = result.filter(x=>x.kind()!=tsInterfaces.MetaInformationKind.Example
                && x.kind()!=tsInterfaces.MetaInformationKind.Examples);
        }

        return result;
    }

    allFacets(){
        let meta = this.meta();
        let result = meta.filter(x=>x.kind()!=tsInterfaces.MetaInformationKind.FacetDeclaration);
        return result;
    }

    isRecursionPoint():boolean{
        return false;
    }

    examples(expand:boolean):IExample[]{
        if(this._original){
            let examples = <IExample[]>this._original.examples();
            return examples;
        }
        return [];
    }

    declaredExampleFacets() {
        let result:ITypeFacet[] = [];
        if(this._original){
            result = this._original.declaredFacets();
            result = result.filter(x=>x.kind()==tsInterfaces.MetaInformationKind.Example
                || x.kind()==tsInterfaces.MetaInformationKind.Examples);
        }

        return result;
    }

    meta(){
        let result:ITypeFacet[] = [];
        if(this._original){
            result = this._original.allFacets();
        }
        else{
            for(let st of this.superTypes()){
                st.allFacets().forEach(x=>result.push(x));
            }
        }
        result = result.filter(x=>x.kind()!=tsInterfaces.MetaInformationKind.Example
                                && x.kind()!=tsInterfaces.MetaInformationKind.Examples);
        return result;
    }

    schemaPath():string{
        let schPath = _.find(this.meta(),x=>x.kind()==tsInterfaces.MetaInformationKind.SchemaPath);
        return schPath && schPath.value();
    }

    sourceMap():ElementSourceInfo{
        let sourceMap = _.find(this.declaredFacets(),x=>x.kind()==tsInterfaces.MetaInformationKind.SchemaPath);
        if(sourceMap){
            return sourceMap.value();
        }
        return null;
    }
}

var globalId = 0;

export class GeneralTypeEntry extends AbstractTypeEntry{

    protected facets:PropertyEntry[] = [];

    constructor(
        _original:IParsedType,
        _superTypes:TypeEntry[]=[],
        protected _componentType: TypeEntry,
        protected _properties: PropertyEntry[]=[],
        protected _facets: PropertyEntry[]=[],
        protected _name:string){
        super(_original,_superTypes);
    }

    private _isRecursionPoint:boolean;

    private _depth:number;

    private metadataSource:TypeEntry;

    setDepth(d:number){
        this._depth = d;
    }

    depth(){
        return this._depth;
    }

    clone(ct?:TypeEntry):GeneralTypeEntry{
        return new GeneralTypeEntry(this._original,[],ct, [], [], this.name());
    }

    possibleBuiltInTypes(occured:{[key:string]:boolean}={}):string[]{
        if(this.name()){
            if(occured[this.name()]){
                return [];
            }
            occured[this.name()] = true;
        }
        let result:string[] = [];
        // if(this.original()&&!this.original().isUnion()) {
        //     let possibleTypes = [this.original()].concat(this.original().allSuperTypes()).filter(x => x.isBuiltin());
        //     for (let o of this.original().allOptions()) {
        //         possibleTypes = possibleTypes.concat([o].concat(o.allSuperTypes()).filter(x => x.isBuiltin()));
        //     }
        //     possibleTypes = _.unique(possibleTypes);
        //     let map:{[key:string]:typeSystem.IParsedType} = {};
        //     possibleTypes.forEach(x=>map[x.name()]=x);
        //     possibleTypes.forEach(x=>{
        //         x.allSuperTypes().forEach(y=>delete map[y.name()]);
        //     });
        //     result = _.unique(Object.keys(map));
        // }
        // else {
            for(let st of this.superTypes()){
                if(!st.isUnion()) {
                    result = result.concat(st.possibleBuiltInTypes(occured));
                }
            }
            let map:{[key:string]:boolean} = {};
            result.forEach(x=>map[x]=true);
            result.forEach(x=>{
                let t = typeSystem.builtInTypes().get(x);
                if(t) {
                    t.allSuperTypes().forEach(y => delete map[y.name()]);
                }
            });
            delete map["unknown"];
            result = Object.keys(map);
       // }
        return result;
    }

    componentType():TypeEntry{
        return this._componentType;
    }

    setComponentType(componentType:TypeEntry){
            this._componentType = componentType;
    }

    properties():PropertyEntry[]{
        return this._properties;
    }

    definedFacets():PropertyEntry[]{
        return this._facets;
    }

    addProperty(propertyEntry:PropertyEntry){
        this._properties.push(propertyEntry);
    }

    addFacet(propertyEntry:PropertyEntry){
        this._facets.push(propertyEntry);
    }

    append(te:GeneralTypeEntry,bd:BranchingData):void{

        if (this._original && this._original.kind() != "union") {
            te._original = this._original;
        }
        if (this.isExternal()) {
            return;
        }
        if(bd.typeMap().hasType(this)&&this.depth()==0){//isRecursionPoint()){
            te.setIsRecursionPoint();
            return;
        }
        bd.typeMap().addType(this);
        try {
            if (this._componentType) {
                let ct = bd.expander().expandHierarchy(
                    this._componentType, this._componentType.branchingRegistry(), bd.typeMap());
                //if(!te.componentType()) {
                    te.setComponentType(ct);
                // }
                // else{
                //     let cType = new GeneralTypeEntry(null,[],null,[],[],null);
                //     te.componentType().append(cType,null);
                //     ct.append(cType,null);
                //     te.setComponentType(cType);
                // }
            }
            if (this._properties.length > 0) {
                let pMap:{[key:string]:PropertyEntry[]} = {};
                for (let p of this._properties) {
                    let pName = p.name();
                    let pArr = pMap[pName];
                    if(!pArr){
                        pArr = [];
                        pMap[pName] = pArr;
                    }
                    pArr.push(p);
                }
                for (let pName of Object.keys(pMap)) {
                    let pArr = pMap[pName];
                    if(pArr.length==1) {
                        pArr[0].append(te, bd);
                    }
                    else{
                        let pType = new GeneralTypeEntry(null,[],null,[], [], null);
                        let required = false;
                        pArr.forEach(x=>{
                            pType.addSuperType(x.type());
                            required = required || x.required();
                        });
                        let mergedProp = new PropertyEntry(null,pName,pType,required,false,null);
                        mergedProp.append(te, bd);
                    }
                }
            }
            if (this._facets.length > 0) {
                for (let f of this._facets) {
                    f.append(te, bd);
                }
            }
            for (let st of this.superTypes()) {
                st.append(te, bd);
                te.addSuperType(st);
            }
        }
        finally {
            bd.typeMap().removeType(this);
        }
    }

    name(){
        return this._name || super.name();
    }

    isRecursionPoint():boolean{
        return this._isRecursionPoint;
    }

    setIsRecursionPoint(val:boolean=true){
        this._isRecursionPoint = val;
    }
}

export class BuiltInTypeEntry extends AbstractTypeEntry{

    constructor(protected _original:IParsedType){
        super(_original,[]);
    }

    possibleBuiltInTypes():string[]{
        return [ this._original.name() ];
    }

    isBuiltIn():boolean{
        return true;
    }

    append(te:GeneralTypeEntry,bd:BranchingData):void{
        te.addSuperType(this);
    }

}

export class UnionTypeEntry extends AbstractTypeEntry{

    constructor(
        original:IParsedType,
        protected _options:TypeEntry[],
        protected _branchId:number){
        super(original,[]);
    }

    isUnion():boolean{
        return true;
    }

    branchId():number{
        return this._branchId;
    }

    append(te:GeneralTypeEntry,bd:BranchingData):void{
        let optionId = bd.branchingOption(this._branchId);
        let option = this._options[optionId];
        option.append(te,bd);
    }

    clone():TypeEntry{
        throw new Error("Not implemented");
    }

    possibleBuiltInTypes(occured:{[key:string]:boolean}={}):string[]{
        let result:string[] = [];
        if(this.name()){
            if(occured[this.name()]){
                return [];
            }
            occured[this.name()] = true;
        }
        this._options.forEach(x=>result=result.concat(x.possibleBuiltInTypes(occured)));
        result = _.unique(result);
        return result;
    }

    options():TypeEntry[]{
        return this._options;
    }
}

export class IntersectionTypeEntry extends AbstractTypeEntry{

    constructor(original:IParsedType, protected options:TypeEntry[]){
        super(original,[]);
    }

    isIntersection():boolean{
        return true;
    }

    append(te:TypeEntry,bd:BranchingData):void{
        throw new Error("not implemented");
    }

    clone():TypeEntry{
        throw new Error("Not implemented");
    }

    possibleBuiltInTypes(occured:{[key:string]:boolean}={}):string[]{
        if(this.name()){
            if(occured[this.name()]){
                return [];
            }
            occured[this.name()] = true;
        }
        let possibleTypes = this.options.map(x=>x.possibleBuiltInTypes(occured));
        let result = possibleTypes[0];
        for(let i = 1 ; i < possibleTypes.length ; i++){
            result = _.intersection(result,possibleTypes[i]);
        }
        return result;
    }
}

function mergeMeta(to,from){
    if(!from){
        return;
    }
    else if(!to){
        return from;
    }
    for(let key of Object.keys(from)){
        if(!to.hasOwnProperty(key)){
            to[key] = from[key];
        }
        else if(key=="primitiveValuesMeta"){
            for(let key1 of Object.keys(from.primitiveValuesMeta)){
                if(!to.primitiveValuesMeta.hasOwnProperty(key1)) {
                    to.primitiveValuesMeta[key1] = from.primitiveValuesMeta[key1];
                }
            }
        }
    }

}

class BasicTypeMap implements TypeMap{

    private map:{[key:string]:TypeEntry} = {};

    addType(t:TypeEntry):void{
        let n = t.id();
        if(n){
            this.map[n] = t;
        }
    }

    removeType(t:TypeEntry):void{
        let n = t.id();
        if(n){
            delete this.map[n];
        }
    }

    hasType(t:TypeEntry):boolean{
        let n = t.id();
        return this.map[n] !== undefined;
    }
}

class BasicBranchingData implements BranchingData{

    constructor(
        private arr:number[],
        private _expander:TypeExpander,
        private _typeMap:TypeMap = new BasicTypeMap()){}

    branchingOption(branchId:number){
        if(branchId>this.arr.length-1){
            throw new Error("Branch index exceeds total branches count");
        }
        return this.arr[branchId];
    }

    typeMap(){
        return this._typeMap;
    }

    expander(){
        return this._expander;
    }
}


class BasicBranchingRegistry implements BranchingRegistry{

    constructor(protected _expander:TypeExpander){}

    private arr:number[] = [];

    expander(){
        return this._expander;
    }

    nextBranchId(optionsCount:number):number{
        let result = this.arr.length;
        this.arr.push(optionsCount);
        return result;
    }

    possibleBranches(typeMap:TypeMap):BranchingData[]{
        let steps:number[] = [];
        let ranks:number[] = [];
        let count = 1;
        let rank = 1;
        let l = this.arr.length;
        for(let i = 0 ; i < l ; i++){
            steps.push(count);
            ranks.push(rank);
            count *= this.arr[i];
            rank *= this.arr[l-1-i];
        }
        ranks = ranks.reverse();
        let sequences:number[][]= [];
        for(let i = 0 ; i < count ; i++){
            sequences.push([]);
        }
        // 2,3,3
        // r l c ------------------
        // 9 2 1 000000000111111111
        // 3 3 2 000111222000111222
        // 1 3 6 123123123123123123
        for(let i = 0 ; i < l ; i++){
            let ind = 0;
            let currentOptionsCount = this.arr[i];
            for(let j0 = 0 ; j0 < steps[i] ; j0++ ){
                for(let j1 = 0 ; j1 < currentOptionsCount ; j1++){
                    for(let j2 = 0 ; j2 < ranks[i] ; j2++){
                        sequences[ind++].push(j1);
                    }
                }
            }
        }
        let result = sequences.map(x=>new BasicBranchingData(x,this.expander(),typeMap));
        return result;
    }
}

export class TypeExpander {

    serializeType(t: IParsedType, typeExpansionRecursionDepth = 0, isAnnotationType = false) {
        let he: TypeEntry = this.createHierarchyEntry(t, typeExpansionRecursionDepth, isAnnotationType);
        const expand = typeExpansionRecursionDepth >= 0;
        if (expand) {
            he = this.expandHierarchy(he, he.branchingRegistry());
        }
        let result = this.dump(he, expand);
        return result;
    }

    protected createHierarchyEntry(
        t:IParsedType,
        typeExpansionRecursionDepth:number,
        isAnnotationType=false,
        occured:{[key:string]:AbstractTypeEntry}={},
        branchingRegistry?:BranchingRegistry):AbstractTypeEntry{

        let isNewTree = false;
        if(!branchingRegistry){
            isNewTree = true;
            branchingRegistry = new BasicBranchingRegistry(this);
        }
        let result = this.doCreateHierarchyEntry(t, typeExpansionRecursionDepth,isAnnotationType, occured, branchingRegistry);
        if(isNewTree){
            result.setBranchingRegistry(branchingRegistry);
        }
        return result;
    }

    protected doCreateHierarchyEntry(
        t:IParsedType,
        typeExpansionRecursionDepth:number,
        isAnnotationType=false,
        occured:{[key:string]:AbstractTypeEntry}={},
        branchingRegistry:BranchingRegistry):AbstractTypeEntry{

        if(t.isBuiltin()){
            let result = occured[t.name()];
            if(!result){
                result = new BuiltInTypeEntry(t);
                occured[t.name()] = result;
            }
            return result;
        }
        let d = 0;
        if(t.name() && occured[t.name()]){
            if(typeExpansionRecursionDepth<=0) {
                return occured[t.name()];
            }
            else{
                d = typeExpansionRecursionDepth;
                typeExpansionRecursionDepth--;
            }
        }
        if(t.isUnion()&&t.superTypes().length==0){
            let options = t.options();
            let optionEntries:TypeEntry[] = [];
            for(let o of options){
                optionEntries.push(
                    this.createHierarchyEntry(o,typeExpansionRecursionDepth,false,occured,branchingRegistry));
            }
            let branchId = branchingRegistry.nextBranchId(optionEntries.length);
            let unionSuperType = new UnionTypeEntry(t, optionEntries, branchId);
            return unionSuperType;
        }
        let result = new GeneralTypeEntry(t, [],null,[], [], t.name());
        result.setDepth(d);
        if(t.name()!=null && !occured[t.name()]) {
            occured[t.name()] = result;
        }


        let superTypeEntries:TypeEntry[] = [];
        if(typeExpansionRecursionDepth==-1){
            const allSuperTypes:IParsedType[] = t.superTypes();
            let superTypes = allSuperTypes;//.filter(x=>!x.isUnion());
            for (let st of superTypes) {
                let ste = this.createHierarchyEntry(
                    st, typeExpansionRecursionDepth, false,occured, branchingRegistry);
                superTypeEntries.push(ste);
            }
        }
        else {
            const allSuperTypes:IParsedType[] = t.allSuperTypes();
            let superTypes = allSuperTypes.filter(x=>!x.isUnion());
            for (let st of superTypes) {
                if (st.isBuiltin()) {
                    let ste = this.createHierarchyEntry(
                        st, typeExpansionRecursionDepth, false,occured, branchingRegistry);
                    superTypeEntries.push(ste);
                }
            }
        }
        let options = t.allOptions();
        let properties = typeExpansionRecursionDepth>=0 ? t.properties() : t.declaredProperties();
        if(typeExpansionRecursionDepth>=0&&options.length>1){
            let optionEntries:TypeEntry[] = [];
            for(let o of options){
                optionEntries.push(this.createHierarchyEntry(
                    o,typeExpansionRecursionDepth,false,occured,branchingRegistry));
            }
            let branchId = branchingRegistry.nextBranchId(optionEntries.length);
            let unionSuperType = new UnionTypeEntry(t, optionEntries, branchId);
            superTypeEntries.push(unionSuperType);
        }
        if(t.isArray()){
            let ct = t.componentType();
            if(ct) {
                if(isEmpty(ct)){
                    ct = ct.superTypes()[0];
                }
                let componentTypeEntry = this.createHierarchyEntry(
                    ct,typeExpansionRecursionDepth, false,occured);
                result.setComponentType(componentTypeEntry);
            }
        }
        let propertyEntries:PropertyEntry[] = [];
        if(properties.length>0){
            for(let p of properties){
                let pe = this.processPropertyHierarchy(p, typeExpansionRecursionDepth, t, occured, branchingRegistry);
                propertyEntries.push(pe);
            }
        }
        for(let st of superTypeEntries) {
            result.addSuperType(st);
        }
        for(let pe of propertyEntries){
            result.addProperty(pe);
        }
        let definedFacets = typeExpansionRecursionDepth>=0 ? t.allDefinedFacets() : t.definedFacets();
        if(definedFacets.length>0){
            for(let p of definedFacets){
                let fe = this.processPropertyHierarchy(p, typeExpansionRecursionDepth, t, occured, branchingRegistry,true);
                result.addFacet(fe);
            }
        }
        return result;
    }

    protected extractParserMetadata(pt: IParsedType) {
        let meta: any;
        let metaArr = pt.declaredFacets().filter(x => x.facetName() == "__METADATA__");
        if (metaArr.length) {
            meta = metaArr[0].value();
        }
        return meta;
    }

    protected processPropertyHierarchy(
        p:tsInterfaces.IPropertyInfo,
        typeExpansionRecursionDepth: number,
        t: IParsedType,
        occured: { [p: string]: AbstractTypeEntry },
        branchingRegistry: BranchingRegistry,
        isFacet=false)
    {
        let pt = p.range();
        let meta = this.extractParserMetadata(pt);
        let owner = p.declaredAt();
        let pte: TypeEntry;
        let d = typeExpansionRecursionDepth;
        if (owner.name() && (!t.name() || owner.name() != t.name()) && occured[owner.name()]) {
            if (typeExpansionRecursionDepth <= 0) {
                pte = occured[owner.name()];
            }
            else {
                d--;
            }
        }
        if (!pte) {
            if (isEmpty(pt)) {
                pt = pt.superTypes()[0];
                //mergeMeta(meta,extractParserMetadata(pt));
            }
            pte = this.createHierarchyEntry(
                pt, d, false, occured, branchingRegistry);
        }
        let pe = new PropertyEntry(p, null, pte, p.required(),isFacet,meta);
        return pe;
    }

    expandHierarchy(e:TypeEntry,reg:BranchingRegistry,typeMap?:TypeMap):TypeEntry{

        if(!reg){
            return e;
        }

        let entries:GeneralTypeEntry[] = [];
        for(let bd of reg.possibleBranches(typeMap)){
            let branchEntry = new GeneralTypeEntry(null,[],null,[], [], e.name());
            e.append(branchEntry,bd);
            entries.push(branchEntry);
        }
        if(entries.length==1){
            return entries[0];
        }
        let result = new UnionTypeEntry(e.original(),entries,-1);
        return result;
    }

    protected appendSourceFromExtras(result: any, te: TypeEntry) {
        if (!result.sourceMap) {
            let src = te.original() && te.original().getExtra("SOURCE");
            if (src) {
                // let llSrc: ll.ILowLevelASTNode;
                // if (hlImpl.LowLevelWrapperForTypeSystem.isInstance(src)) {
                //     llSrc = src.node();
                // }
                // else if (hlImpl.ASTNodeImpl.isInstance(src)) {
                //     llSrc = src.lowLevel();
                // }
                // else
                if (src.obj && src.obj.sourceMap) {
                    result.sourceMap = src.obj.sourceMap;
                }
                // if (llSrc) {
                //     result.sourceMap = {
                //         path: llSrc.unit().path()
                //     };
                // }
            }
        }
    }


    protected dump(te: TypeEntry, expand: boolean): any {

        let result: any = {};
        let name = te.name();
        if (name) {
            result.name = name;
            if (te.isRecursionPoint()) {
                result = {
                    type: ["any"]
                };
                this.appendSourceFromExtras(result, te);
                return result;
            }
        }
        const superTypes = te.superTypes();
        if (te.isBuiltIn()) {
            result = {
                type: [name],
                typePropertyKind: "TYPE_EXPRESSION"
            }
        }
        else if (te.isExternal()) {
            if (!expand && superTypes[0].name() && te.original().allSuperTypes().length > 3) {
                result.type = [superTypes[0].name()];
                result.typePropertyKind = "TYPE_EXPRESSION";
            }
            else {
                let sch = te.schema();
                if (sch) {
                    sch = sch.trim();
                    result.type = [sch];
                    if (te.schemaPath()) {
                        result.schemaPath = te.schemaPath();
                    }
                    var canBeJson = (sch[0] === "{" && sch[sch.length - 1] === "}");
                    var canBeXml = (sch[0] === "<" && sch[sch.length - 1] === ">");

                    if (canBeJson) {
                        result.typePropertyKind = "JSON";
                    } else if (canBeXml) {
                        result.typePropertyKind = "XML";
                    } else {
                        result.typePropertyKind = "TYPE_EXPRESSION";
                    }
                }
            }
        }
        else if (te.isUnion()) {
            result.typePropertyKind = "TYPE_EXPRESSION";
            let ute = <UnionTypeEntry>te;
            let options = ute.options();
            if (options.length > 0) {
                result.type = ["union"];
                let anyOf: any[] = [];
                result.anyOf = anyOf;
                for (let o of options) {
                    if (!expand && o.name()) {
                        anyOf.push(o.name());
                    }
                    else {
                        let dumpedOption = this.dump(o, expand);
                        this.appendSourceFromExtras(dumpedOption, ute);
                        anyOf.push(dumpedOption);
                    }
                }
            }
        }
        else {
            if (superTypes.length && (superTypes[0].name() || superTypes[0].isUnion())) {
                result.typePropertyKind = "TYPE_EXPRESSION";
            }
            else {
                result.typePropertyKind = "INPLACE";
            }
            let gte = <GeneralTypeEntry>te;
            if (expand) {
                let type = gte.possibleBuiltInTypes();
                if (type.length > 0) {
                    result.type = type;
                }
            }
            else {
                let type: any[] = [];
                for (let st of superTypes) {
                    if (st.name()) {
                        type.push(st.name());
                    }
                    else {
                        const dumped = this.dump(st, expand);
                        dumped.name = "type";
                        dumped.displayName = "type";
                        this.appendMeta(dumped, "displayName", "calculated");
                        type.push(dumped);
                    }
                }
                result.type = type;
            }
            let properties = gte.properties();
            if (properties && properties.length > 0) {
                let props: any[] = [];
                result.properties = props;
                for (let p of properties) {
                    const dumpedPropertyType = this.dumpProperty(p, gte, expand);
                    props.push(dumpedPropertyType);
                }
            }
            let facets = gte.definedFacets();
            if (facets && facets.length > 0) {
                let facetArr: any[] = [];
                result.facets = facetArr;
                for (let f of facets) {
                    const dumpedFacetType = this.dumpProperty(f, gte, expand, true);
                    facetArr.push(dumpedFacetType);
                }
            }
            let ct = gte.componentType();
            if (ct) {
                if (!expand && ct.name()) {
                    result.items = [{
                        type: [ct.name()],
                        name: "items",
                        displayName: "items",
                        typePropertyKind: "TYPE_EXPRESSION"
                    }];
                    this.appendMeta(result.items[0], "displayName", "calculated");
                }
                else {
                    let dumpedComponentType = this.dump(ct, expand);
                    this.appendSourceFromExtras(dumpedComponentType, gte);
                    if (!ct.isUnion() && !dumpedComponentType.name) {
                        dumpedComponentType.name = "items";
                        dumpedComponentType.displayName = "items";
                        this.appendMeta(dumpedComponentType, "displayName", "calculated");
                    }
                    result.items = [dumpedComponentType];
                }
            }
            this.dumpFacets(te, result, expand);
        }
        let examples = te.examples(expand);
        if (examples.length > 0) {
            let simplified: any[] = [];
            let examplesArr: any[] = [];
            result.examples = examplesArr;
            result.simplifiedExamples = simplified;
            for (let e of examples) {
                let val = e.value();
                let needStringify = false;
                if (Array.isArray(val)) {
                    for (let c of val) {
                        if (Array.isArray(c) || (typeof val == "object")) {
                            needStringify = true;
                            break;
                        }
                    }
                }
                else if (typeof val == "object") {
                    needStringify = true;
                }
                let simpleValue = needStringify ? JSON.stringify(val) : val;
                simplified.push(simpleValue);
                let eObj: any = {
                    strict: e.strict(),
                    value: val
                };
                if (e.name()) {
                    eObj.name = e.name();
                }
                if (e.displayName() != null) {
                    eObj.displayName = e.displayName();
                }
                if (e.description()) {
                    eObj.description = e.description();
                }
                let annotations = e.annotations();
                let aArr = this.dumpAnnotations(annotations, eObj);
                examplesArr.push(eObj);
            }
        }
        let annotations = te.original() && te.original().annotations();
        this.dumpAnnotations(annotations, result);
        this.dumpMeta(te, result, expand);
        this.appendSourceFromExtras(result, te);
        if (!result.displayName && result.name) {
            result.displayName = result.name;
            this.appendMeta(result, "displayName", "calculated");
        }
        this.checkIfTypePropertyIsDefault(te, result);
        return result;
    }


    protected checkIfTypePropertyIsDefault(te: TypeEntry, result: any) {
        if (te.isBuiltIn()) {
            return;
        }
        if (te.original() && te.original().isUnion()) {
            return;
        }
        if (!this.sourceHasKey(te, "type")) {
            let byDefault = false;
            if (!Array.isArray(result.type) || !result.type.length) {
                byDefault = true;
            }
            else {
                byDefault = result.type[0] != "array";
            }
            if (byDefault) {
                this.appendMeta(result, "type", "insertedAsDefault");
            }
        }
    }

    protected dumpProperty(
        p: PropertyEntry,
        gte: GeneralTypeEntry,
        expand: boolean,
        isFacet = false) {

        let dumpedPropertyType: any;
        const propType = p.type();
        if (!expand && propType.name()) {
            dumpedPropertyType = {
                type: [propType.name()],
                displayName: p.name(),
                typePropertyKind: "TYPE_EXPRESSION"
            };
            this.appendMeta(dumpedPropertyType, "displayName", "calculated");
        }
        else {
            dumpedPropertyType = this.dump(propType, expand);
            if (dumpedPropertyType.displayName == null || propType.name()) {
                dumpedPropertyType.displayName = p.name();
                this.appendMeta(dumpedPropertyType, "displayName", "calculated");
            }
        }
        this.appendSourceFromExtras(dumpedPropertyType, gte);
        dumpedPropertyType.name = p.name();
        if (!isFacet) {
            dumpedPropertyType.required = p.required();
        }
        if (p.metadata()) {
            dumpedPropertyType.__METADATA__ = p.metadata();
        }
        else if (!isFacet) {
            if (p.required()) {
                if (propType.name() || propType.isBuiltIn()) {
                    this.appendMeta(dumpedPropertyType, "required", "insertedAsDefault");
                }
                else if (!this.sourceHasKey(propType, "required")) {
                    this.appendMeta(dumpedPropertyType, "required", "insertedAsDefault");
                }
            }
        }
        this.checkIfTypePropertyIsDefault(propType, dumpedPropertyType);
        return dumpedPropertyType;
    }

    protected dumpAnnotations(annotations: IAnnotation[], obj: any) {
        if (annotations && annotations.length > 0) {
            let aArr: any[] = [];
            obj.annotations = aArr;
            annotations.forEach(x => {
                aArr.push({
                    name: x.name(),
                    value: x.value()
                })
            })
        }
    };

    protected dumpFacets(te: TypeEntry, result: any, expand: boolean) {
        let customFacets: ITypeFacet[];
        if (te.original()) {
            if (expand) {
                customFacets = te.original().allCustomFacets();
            }
            else {
                customFacets = te.original().customFacets();
            }
        }
        if (customFacets && customFacets.length > 0) {
            let facetsObj: { name: string, value: any }[] = [];
            result.fixedFacets = facetsObj;
            customFacets.forEach(x => {
                try {
                    let val = x.value();
                    if (typeof val == 'object') {
                        JSON.stringify(val);
                    }
                    facetsObj.push({
                        name: x.facetName(),
                        value: val
                    });
                }
                catch (e) {
                    console.log('Error while dumping ' + x.facetName());
                    console.log(e);
                }
            });
        }
        let builtInTypes = te.possibleBuiltInTypes({});
        let propMap = defSysUtil.propertiesForBuiltinTypes(builtInTypes);
        let facetsMap: { [key: string]: ITypeFacet[] } = {};
        const facets = expand ? te.allFacets() : te.declaredFacets();
        for (let f of facets) {
            if (f.kind() == tsInterfaces.MetaInformationKind.DiscriminatorValue) {
                if (!(<any>f).isStrict()) {
                    continue;
                }
            }
            let fn = f.facetName();
            if (propMap[fn]) {
                let fArr = facetsMap[fn];
                if (!fArr) {
                    fArr = [];
                    facetsMap[fn] = fArr;
                }
                fArr.push(f);
            }
        }
        for (let fn of Object.keys(facetsMap)) {
            let fArr = facetsMap[fn];
            let val: any;
            if (fArr.length == 1) {
                val = fArr[0].value();
            }
            else {
                val = this.mergeFacetValues(fArr);
            }
            if (typeof val == "string" || typeof val == "number" || typeof val == "boolean") {
                result[fn] = val;
            }
        }
    }

    protected mergeFacetValues(arr: ITypeFacet[]): any {
        if (arr.length == 0) {
            return null;
        }
        let c: IConstraint;
        for (let f of arr) {
            if (!c) {
                if (!f.isConstraint()) {
                    return f.value();
                }
                c = <IConstraint>f;
                continue;
            }
            if (!f.isConstraint()) {
                continue;
            }
            c = c.composeWith(<IConstraint>f);
        }
        if (!c) {
            return arr[0].value();
        }
        return c.value();

    }

    protected dumpMeta(te: TypeEntry, result: any, expand: boolean) {

        const meta = expand ? te.meta() : te.declaredFacets();
        for (let m of meta) {
            let name = m.facetName();
            if (defSysUtil.MetaNamesProvider.getInstance().hasProperty(name)) {
                if (!result.hasOwnProperty(name)) {
                    result[name] = m.value();
                }
            }
            else if (name == "closed") {
                result["additionalProperties"] = m.value();
            }
        }
    }

    protected sourceHasKey(te: TypeEntry, key: string) {
        let src = te.original() && te.original().getExtra("SOURCE");
        let result: boolean = null;
        if (src) {
            // if (hlImpl.LowLevelWrapperForTypeSystem.isInstance(src)) {
            //     result = src.childWithKey(key)!=null;
            // }
            // else if (hlImpl.ASTNodeImpl.isInstance(src)) {
            //     result = src.attr(key)!=null;
            // }
            // else
            if (src.obj) {
                result = src.obj.hasOwnProperty(key);
            }
        }
        return result;
    }

    protected appendMeta(obj:any,field:string,kind:string){
        // if(!this.options.serializeMetadata){
        //     return;
        // }
        let metaObj = obj.__METADATA__;
        if(!metaObj){
            metaObj = {};
            obj.__METADATA__ = metaObj;
        }
        let scalarsObj = metaObj.primitiveValuesMeta;
        if(!scalarsObj){
            scalarsObj = {};
            metaObj.primitiveValuesMeta = scalarsObj;
        }
        let fObj = scalarsObj[field];
        if(!fObj){
            fObj = {};
            scalarsObj[field] = fObj;
        }
        fObj[kind] = true;
    }
}

const filterOut = [ "typePropertyKind","sourceMap", "required","__METADATA__", "notScalar" ];

function isEmpty(t:tsInterfaces.IParsedType):boolean{

    if(t.isUnion()||t.isBuiltin()||t.name()||t.superTypes().length!=1){
        return false;
    }
    let meta = t.declaredFacets().filter(x=>{
        const fn = x.facetName();
        if(filterOut.indexOf(fn)>=0){
            return false;
        }
        if(fn=="discriminatorValue"){
            const strict = x['isStrict'];
            return (typeof strict != "function") || strict.call(x);
        }
        else if(fn=="__METADATA__"){
            const meta = x.value();
            let pMeta = meta.primitiveValuesMeta;
            if(!pMeta && Object.keys(meta).length==0){
                return false;
            }
            else if(pMeta){
                if(!Object.keys(pMeta).filter(y=>y!="displayName"&&y!="required").length){
                    return false;
                }
                return true;
            }
            return true;
        }
        return true;
    });
    return meta.length==0;
}