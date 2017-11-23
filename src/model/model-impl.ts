import ts = require("../typesystem/parse");
import ti = ts.tsInterfaces;
import raml = require("./model-interfaces");
import root = require("../typings-new-format/raml");
import api = require("../typings-new-format/spec-1.0/api");
import datamodel = require("../typings-new-format/spec-1.0/datamodel");
import resources = require("../typings-new-format/spec-1.0/resources");
import methods = require("../typings-new-format/spec-1.0/methods");
import security = require("../typings-new-format/spec-1.0/security");
import common = require("../typings-new-format/spec-1.0/common");
import api08 = require("../typings-new-format/spec-0.8/api");
import bodies08 = require("../typings-new-format/spec-0.8/bodies");
import parameters08 = require("../typings-new-format/spec-0.8/parameters");
import methods08 = require("../typings-new-format/spec-0.8/methods");
import resources08 = require("../typings-new-format/spec-0.8/resources");
import security08 = require("../typings-new-format/spec-0.8/security");

function normalizeTypes(target: any, typesArray:datamodel.TypeDeclaration[], types: string, resultName: string = types) {
    if(!typesArray || !typesArray.length){
        return ;
    }
    for (let t of typesArray) {
        let nm = t.name;
        target[resultName][nm] = normalizeType(t);
    }
}

let normalizeExample = function (e) {
    let ex = JSON.parse(JSON.stringify(e));
    delete ex.name;
    delete ex.annotations;
    delete ex.scalarsAnnotations;
    serializeAnnotations(e,ex);
    return ex;
};

function serializeAnnotations(t:{
    annotations?: common.AnnotationInstance[]
    scalarsAnnotations?: { [key: string]: common.AnnotationInstance[][] };
}, res: any) {
    if (t.annotations) {
        for (let x of t.annotations) {
            res[`(${x.name})`] = x.value;
        }
    }
    if(t.scalarsAnnotations){
        for(let pName of Object.keys(t.scalarsAnnotations)){
            let aArr = t.scalarsAnnotations[pName];
            let val = res[pName];
            if(Array.isArray(val)){
                for(let i = 0 ; i < val.length && i < aArr.length ; i++){
                    if(!aArr[i].length){
                        continue;
                    }
                    val[i] = {
                        value: val[i]
                    };
                    for(let a of aArr[i]){
                        val[i][`(${a.name})`] = a.value;
                    }
                }
            }
            else if(aArr.length){
                let sAnnotations = aArr[0];
                if(sAnnotations.length){
                    res[pName] = {
                        value: val
                    };
                    for(let a of sAnnotations){
                        res[pName][`(${a.name})`] = a.value;
                    }
                }
            }
        }
    }
}

function normalizeType(i: datamodel.TypeReference10) {
    if(i==null){
        return null;
    }
    if (typeof i == "string") {
        return {type: i};
    }

    if (typeof i == "object") {
        if (Array.isArray(i)) {
            return {type: i};
        }
        let t = <datamodel.TypeDeclaration>i;
        let res: any = JSON.parse(JSON.stringify(t));
        delete res.name;
        delete res.typePropertyKind;
        delete res.annotations;
        delete res.structuredExample;
        delete res.mediaType;
        delete res.scalarsAnnotations;
        delete res.fixedFacets;
        delete res.simplifiedExamples;
        if(Array.isArray(t.type) && t.type.length){
            res.type = t.type.map(x=>{
                if(typeof(x) === "object"){
                    return normalizeType(x);
                }
                return x;
            });
        }
        if (t.examples) {
            if(t.examples.length==1 && t.examples[0].name==null){
                const eObj = t.examples[0];
                if(Object.keys(eObj).length==1&&eObj.hasOwnProperty("value")){
                    res.example = eObj.value;
                }
                else{
                    res.example = normalizeExample(eObj);
                }
                delete res.examples;
            }
            else if(!t.examples.filter(x=>x.name!=null).length) {
                //support for sequence instead of map in 'examples'
                res.examples = t.examples.map(x=>normalizeExample(x));
            }
            else{
                let examples = {};
                t.examples.forEach(e => {
                    let name = e.name;
                    let ex = normalizeExample(e);
                    if(!name){
                        res.example = ex;
                    }
                    else {
                        examples[e.name] = ex;
                    }
                });
                if(Object.keys(examples).length) {
                    res.examples = examples;
                }
            }
        }
        let properties = (<datamodel.ObjectTypeDeclaration>t).properties;
        if (properties && properties.length) {
            res.properties = {};
            properties.forEach(x=>res.properties[x.name]=normalizeType(x));
        }
        let facets = t.facets;
        if (facets && facets.length) {
            res.facets = {};
            facets.forEach(x=>res.facets[x.name]=normalizeType(x));
        }
        let items = (<datamodel.ArrayTypeDeclaration>t).items;
        if(items && items.length){
            res.items = res.items.map(x=>normalizeType(x));
        }
        let options = (<datamodel.TypeDeclaration>t).anyOf;
        if(options && options.length){
            res.anyOf = options.map(x=>normalizeType(x));
        }
        if (t.fixedFacets) {
            for( let x of t.fixedFacets){
                res[x.name] = x.value;
            }
        }
        serializeAnnotations(t, res);
        removeDefaults(res,t);
        return res;
    }
}

const redundantMetaNames = {
    "displayName": true,
    "required": true,
};

function removeDefaults(result:Object,t:datamodel.TypeDeclaration){
    let meta = t.__METADATA__;
    if(!meta){
        return;
    }
    let scalarsMeta = meta.primitiveValuesMeta;
    if(!scalarsMeta){
        return;
    }
    for(let pName of Object.keys(scalarsMeta).filter(x=>redundantMetaNames[x])){
        let sMeta = scalarsMeta[pName];
        if(sMeta.calculated||sMeta.insertedAsDefault){
            if(pName=="displayName"&&t.name&&t.displayName&&t.name!=t.displayName){
                continue;
            }
            delete result[pName];
        }
    }
}

function normalize(api: api.LibraryBase10) {
    let rs: any = {types: {}, annotationTypes: {}};
    normalizeTypes(rs, api.types, "types");
    normalizeTypes(rs, api.annotationTypes, "annotationTypes");
    return rs;
}

export abstract class Annotated{
    annotation(n:string){
        let res: ti.IAnnotation = null;
        this.annotations().forEach(x => {
            if (x.name() == n || x.name().endsWith("." + n)) {
                res = x;
            }
        })
        if (res) {
            return res.value();
        }
        return null;
    }
    abstract annotations(): ti.IAnnotation[]

    abstract scalarsAnnotations():{[key:string]:ti.IAnnotation[][]};
}

export abstract class Proxy<JSONType extends common.Annotable>  {

    constructor(public readonly json: JSONType, public readonly parent: Proxy<any>) {
    }

    abstract name();

    abstract kind();

    description() {
        return (<any>this.json).description || (<any>this.json).usage
    }

    annotationsMap() {
        return null;
    }

    value() {
        return this.json;
    }

    entry() {
        return this.json;
    }

    sourceMap(){
        return <ti.ElementSourceInfo>this.json.sourceMap;
    }

    metadata():any{
        return this.json.__METADATA__;
    }

    root(): Proxy<any> {
        if (this.parent) {
            return (<Proxy<any>>this.parent).root();
        }
        return this;
    }

    parametrizedPart():any{
        if(!this.isInsideTemplate()){
            return null;
        }
        let result = {};
        for(let key of Object.keys(this.json).filter(x=>x.indexOf("<<")>=0)){
            result[key] = this.json[key];
        }
        return result;
    }

    isInsideTemplate():boolean{
        return this.parent ? this.parent.isInsideTemplate(): false;
    }
}

export abstract class Proxy10<JSONType extends common.Annotable> extends Proxy<JSONType> implements ti.IAnnotatedElement, raml.HasSource10{

    constructor(json: JSONType, parent: Proxy10<any>) {
        super(json,parent);
    }

    private _annotations;

    private _scalarsAnnotations;

    annotation(n:string){
        let res: ti.IAnnotation = null;
        this.annotations().forEach(x => {
            if (x.name() == n || x.name().endsWith("." + n)) {
                res = x;
            }
        })
        if (res) {
            return res.value();
        }
        return null;
    }

    annotations(): ti.IAnnotation[] {
        if (this._annotations) {
            return this._annotations;
        }
        let result: Annotation[] = [];
        if (this.json.annotations) {
            Object.keys(this.json.annotations).forEach(x => {
                let v = this.json.annotations[x];
                result.push(new Annotation(v, this));
            })
        }
        this._annotations = result;
        return this._annotations;
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        if (this._scalarsAnnotations) {
            return this._scalarsAnnotations;
        }
        let result:{[key:string]:Annotation[][]} = {};
        if (this.json.scalarsAnnotations) {
            Object.keys(this.json.scalarsAnnotations).forEach(x => {
                let srcArr1 = this.json.scalarsAnnotations[x];
                if(!srcArr1.length){
                    return;
                }
                let dstArr1:Annotation[][] = [];
                result[x] = dstArr1;
                for(let srcArr2 of srcArr1){
                    let dstArr2 = srcArr2.map(x=>new Annotation(x, this));
                    dstArr1.push(dstArr2);
                }
            });
        }
        this._annotations = result;
        return this._annotations;
    }

    owningFragment(): FragmentBase<any> {
        if (this.parent) {
            return (<Proxy10<any>>this.parent).owningFragment();
        }
        if (this instanceof FragmentBase) {
            return <any>this;
        }
        return null;
    }
}


export class Annotation extends Proxy10<common.AnnotationInstance> implements raml.IAnnotation {


    name(): string {
        return this.json.name;
    }

    isInheritable() {
        return false;
    }

    facetName() {
        return this.json.name;
    }

    owner() {
        return null;
    }

    ownerFacet() {
        return null;
    }

    kind() {
        return ti.MetaInformationKind.Annotation;
    }

    value() {
        return this.json.value;
    }

    definition(): ti.IParsedType {
        let library: FragmentBase<any> = this.owningFragment();
        let tp = library.getAnnotationType(this.json.name);
        if (tp) {
            return tp;
        }
        return null;
    }

    requiredType():ti.IParsedType{
        return null;
    }
    validateSelf(registry: ti.ITypeRegistry):ti.IStatus{ return null; }

    isConstraint(){
        return false;
    }
}


function unique(v: any[]) {
    return Array.from(new Set(v))
}

export abstract class FragmentBase<T> extends Proxy10<T> implements raml.Fragment{


    constructor(
        node: any,
        private tc: ti.IParsedTypeCollection,
        protected _errors:common.Error[] = []) {
        super(node, null);
    }

    getType(name: string): ti.IParsedType {
        return this.tc.getType(name)
    }

    getTypeRegistry() {
        return this.tc.getTypeRegistry();
    }

    getAnnotationTypeRegistry() {
        return this.tc.getAnnotationTypeRegistry();
    }

    types() {
        return unique(this.tc.types())
    }

    annotationTypes() {
        return unique(this.tc.annotationTypes());
    }

    getAnnotationType(name: string): ti.IParsedType {
        return this.tc.getAnnotationType(name);
    }

    abstract kind():string;

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    errors(){
        return this._errors;
    }
}

export class UsesDeclaration extends Proxy10<common.UsesDeclaration> implements raml.UsesDeclaration{

    key(){
        return this.json.key;
    }

    path(){
        return this.json.value;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_USES_DECLARATION;
    }

    name(){
        return this.key();
    }
}

export function mapArray<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = [];
    }
    return obj.map(x => x == null ? x : new clazz(x, parent));
}
export function mapArrayMaps<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = [];
    }
    return obj.map(x => new clazz(x, parent));
}
export function mapMap<T extends Proxy<any>>(parent: Proxy<any>, property: string, clazz: {new(v: any, parent: Proxy<any>): T}): T[] {
    let obj = parent.json[property];
    if (!obj) {
        obj = {};
    }
    let res: T[] = [];
    Object.keys(obj).forEach(x => {
        res.push(new clazz(obj[x], parent))
    });
    return res;
}

function gatherResources(r: raml.Api10|raml.Resource10, res: raml.Resource10[]) {
    let resources: raml.Resource10[] = r.resources();
    resources.forEach(x => {
        res.push(x);
        gatherResources(x, res);
    })
}
export abstract class LibraryBase<T> extends FragmentBase<T> {

    securitySchemes() {
        return mapArrayMaps<SecuritySchemeDefinition10>(this, "securitySchemes", SecuritySchemeDefinition10);
    }

    add(t:ti.IParsedType): void{

    }

    addAnnotationType(t:ti.IParsedType): void{

    }

    library(name: string): ti.IParsedTypeCollection{
        return null;
    }

    traits(){
        return mapArray<Trait10>(this, "traits", Trait10);
    }

    resourceTypes(){
        return mapArray<ResourceType10>(this, "resourceTypes", ResourceType10);
    }
}
// export class SecuritySchemeRef extends Proxy<security.SecuritySchemeBase10> implements raml.SecuredBy {
//
//     name() {
//         if (typeof this.json == "string") {
//             return this.json;
//         }
//         return Object.keys(this.json)[0];
//     }
//
//     settings() {
//         if (typeof this.json == "string") {
//             return {}
//         }
//         return (<any>this.json)[Object.keys(this.json)[0]];
//     }
//
//     kind() {
//         return "SecuritySchemeRef";
//     }
//
//     securitySchemes() {
//         return mapArrayMaps<SecuritySchemeDefinition>(this, "securitySchemes", SecuritySchemeDefinition);
//     }
// }
export class Documentation extends  Proxy10<api.DocumentationItem>{

    name(){
        return this.json.title;
    }

    title(){
        return this.json.title;
    }
    content(){
        return this.json.content;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_DOCUMENTATION
    }
}

export class Documentation08 extends  Proxy<api08.DocumentationItem08>{

    name(){
        return this.json.title;
    }

    title(){
        return this.json.title;
    }
    content(){
        return this.json.content;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_DOCUMENTATION_08
    }
}


export class Api10<T extends api.Api10 = api.Api10> extends LibraryBase<T> implements raml.Api10 {

    constructor(
        node: any,
        tc: ti.IParsedTypeCollection,
        errors:common.Error[]=[]) {
        super(node, tc, errors);
    }

    baseUri(): string {
        return this.json.baseUri;
    }
    protocols(){
        return this.json.protocols;
    }
    mediaType(){
        return this.json.mediaType;
    }
    baseUriParameters(){
        if (this.json.baseUriParameters) {
            return params(this.json.baseUriParameters,this,"baseUri");
        }
        return []
    }

    documentation() {
        return mapArray(this, "documentation", Documentation)
    }

    securedBy() {
        return mapArray(this, "securedBy", SecuritySchemeDefinition10)
    }

    version(): string {
        return this.json.version;
    }

    name() {
        return this.title();
    }

    title() {
        return this.json.title;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_API;
    }

    resources() {
        return mapArray<Resource10>(this, "resources", Resource10);
    }

    allResources() {
        let res: raml.Resource10[] = []
        gatherResources(this, res);
        return res;
    }

    allMethods() {
        let meth: raml.Method10[] = [];
        this.allResources().forEach(x => {
            meth = meth.concat(x.methods());
        })
        return meth;
    }
}

export class Api08 extends Proxy<api08.Api08> implements raml.Api08 {

    constructor(
        node: any,
        protected _errors:common.Error[]=[]) {
        super(node, null);
    }

    baseUri(): string {
        return this.json.baseUri;
    }
    protocols(){
        return this.json.protocols;
    }
    mediaType(){
        return this.json.mediaType;
    }
    baseUriParameters(){
        if (this.json.baseUriParameters) {
            return params08(this.json.baseUriParameters,this, "baseUriParameters");
        }
        return []
    }

    documentation() {
        return mapArray(this, "documentation", Documentation08)
    }

    securedBy() {
        return mapArray(this, "securedBy", SecuritySchemeDefinition08)
    }

    version(): string {
        return this.json.version;
    }

    name() {
        return this.title();
    }

    title() {
        return this.json.title;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_API_08;
    }

    traits() {
        return mapArray<Trait08>(this, "traits", Trait08);
    }

    resourceTypes() {
        return mapArray<ResourceType08>(this, "resourceTypes", ResourceType08);
    }

    securitySchemes() {
        return mapArray<SecuritySchemeDefinition08>(this, "securitySchemes", SecuritySchemeDefinition08);
    }

    resources() {
        return mapArray<Resource08>(this, "resources", Resource08);
    }

    allResources() {
        let res: raml.Resource08[] = []
        //gatherResources(this, res);
        return res;
    }

    allMethods() {
        let meth: raml.Method08[] = [];
        this.allResources().forEach(x => {
            meth = meth.concat(x.methods());
        })
        return meth;
    }

    schemas():GlobalSchema[]{
        let gSchemas = (<api08.Api08><any>this.json).schemas;
        return gSchemas && gSchemas.map(x=>new GlobalSchema(x,this));
    }

    errors(){
        return this._errors;
    }
}

export class Overlay extends Api10<api.Overlay> implements raml.Overlay{

    extends(){
        return this.json.extends;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_OVERLAY;
    }
}

export class Extension extends Api10<api.Extension> implements raml.Extension{

    extends(){
        return this.json.extends;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_EXTENSION;
    }
}

function bodies(t: MethodBase10<any>|Response10) {
    if (!t.json.body) {
        return [];
    }
    let result: Body10[] = []
    for(let x of t.json.body) {
        let name = x.name;
        let td = normalizeType(x);
        let ignoreTypeAttr = false;
        if (t.isInsideTemplate()) {
            let tArr = Array.isArray(x.type) ? x.type : [x.type];
            if (tArr.filter(y => (typeof y === "string")
                    && (y.indexOf("<<") >= 0)).length) {
                ignoreTypeAttr = true;
            }
        }
        let parsedType = ts.parseJsonTypeWithCollection("", td, <any>t.owningFragment(), true,false,false,ignoreTypeAttr);
        let meta:any;
        if(!parsedType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata).length){
            meta = x.__METADATA__;
        }
        result.push(new Body10(name, parsedType, t, meta));
    }
    return result;
}

function params(v: datamodel.TypeDeclaration[], parent: Proxy10<any>, location: string) {

    let result: Parameter10[] = [];
    if (v && v.length>0) {
        for( let x of v){
            let td = normalizeType(x);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>parent.owningFragment(), false);
            let required = x.required;
            let meta:any;
            if(!parsedType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata).length){
                meta = x.__METADATA__;
            }
            result.push(new Parameter10(x.name, parsedType, required, location, parent,meta));
        }
    }
    return result;
}

function params08(json:parameters08.Parameter08[],parent:Proxy<any>,location:string):Parameter08[]{
    if(!json){
        return [];
    }
    return json.map(x=>new Parameter08(x,parent,location));
}

export class Response10 extends Proxy10<methods.Response10> implements raml.Response10 {
    name() {
        return this.json.code;
    }

    code() {
        return this.json.code;
    }

    headers() {
        return params(this.json.headers, this, "responseHeaders");
    }

    bodies() {
        return bodies(this);
    }

    method() {
        return <Method10>this.parent;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_RESPONSE;
    }
}

export class Response08 extends Proxy<bodies08.Response08> implements raml.Response08 {
    name() {
        return this.json.code;
    }

    code() {
        return this.json.code;
    }

    headers() {
        return params08(this.json.headers,this, "headers");
    }

    bodies() {
        return mapArray(this, "body", BodyLike08);
    }

    method() {
        return <Method08>this.parent;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_RESPONSE_08;
    }
}

export class Body10 extends Annotated implements raml.Body10 {

    constructor(private mime: string, private p: ti.IParsedType, private owner:raml.MethodBase10|raml.Response10, private _meta?:any) {
        super()
    }

    mimeType() {
        return this.mime;
    }

    type() {
        return this.p;
    }

    annotations() {
        return this.p.annotations();
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        return this.p.scalarsAnnotations();
    }

    owningFragment(){
        return this.owner && this.owner.owningFragment();
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_BODY;
    }

    meta(){
        return this._meta;
    }

    isInsideTemplate():boolean{
        return this.owner.isInsideTemplate();
    }
}

export class BodyLike08 extends Proxy<bodies08.BodyLike08> implements raml.BodyLike08 {

    name() {
        return this.json.name;
    }

    mimeType() {
        return this.json.name;
    }

    schema() {
        return this.json.schema;
    }

    example() {
        return this.json.example;
    }

    formParameters(){
        let result:raml.Parameter08[] = [];
        if(!this.json.formParameters){
            return result;
        }
        if(!this.json.formParameters){
            return result;
        }
        for(let p of this.json.formParameters){
            result.push(new Parameter08(p,this,"formParameters"));
        }
        return result;
    }

    schemaContent(){
        return this.json.schemaContent;
    }

    description(){
        return this.json.description;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_BODYLIKE_08;
    }

}

export class Parameter10 extends  Annotated implements raml.Parameter10 {

    constructor(private mime: string, private p: ti.IParsedType, private req: boolean, private loc: string, private owner:raml.IAnnotated, private _meta?:any) {
        super();
    }

    required() {
        return this.req;
    }

    location() {
        return this.loc;
    }

    name() {
        return this.mime;
    }

    type() {
        return this.p;
    }

    annotations() {
        return this.p.annotations();
    }

    scalarsAnnotations():{[key:string]:ti.IAnnotation[][]}{
        return this.p.scalarsAnnotations();
    }

    owningFragment(){
        return this.owner && this.owner.owningFragment();
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_PARAMETER;
    }

    meta():any{
        return this._meta;
    }

    isInsideTemplate():boolean{
        return this.owner.isInsideTemplate();
    }
}

export class Parameter08 extends Proxy<parameters08.Parameter08> implements raml.Parameter08 {

    constructor(json: parameters08.Parameter08, parent: Proxy<any>, protected _location:string) {
        super(json,parent);
    }

    name(){
        return this.json.name;
    }

    required(){
        return this.json.required;
    }

    type(){
        return this.json.type;
    }

    location(){
        return this._location;
    }

    displayName(){
        return this.json.displayName;
    }

    default(){
        return this.json.default;
    }

    example(){
        return this.json.example;
    }

    repeat(){
        return this.json.repeat;
    }

    description(){
        return this.json.description;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_PARAMETER_08;
    }

    pattern(){
        if((<parameters08.StringTypeDeclaration08>this.json).pattern!=null){
            return (<parameters08.StringTypeDeclaration08>this.json).pattern;
        }
        return null;
    }

    enum(){
        if((<parameters08.StringTypeDeclaration08>this.json).enum!=null){
            return (<parameters08.StringTypeDeclaration08>this.json).enum;
        }
        return null;
    }

    minLength(){
        if((<parameters08.StringTypeDeclaration08>this.json).minLength!=null){
            return (<parameters08.StringTypeDeclaration08>this.json).minLength;
        }
        return null;
    }

    maxLength(){
        if((<parameters08.StringTypeDeclaration08>this.json).maxLength!=null){
            return (<parameters08.StringTypeDeclaration08>this.json).maxLength;
        }
        return null;
    }

    minimum(){
        if((<parameters08.NumberTypeDeclaration08>this.json).minimum!=null){
            return (<parameters08.NumberTypeDeclaration08>this.json).minimum;
        }
        return null;
    }

    maximum(){
        if((<parameters08.NumberTypeDeclaration08>this.json).maximum!=null){
            return (<parameters08.NumberTypeDeclaration08>this.json).maximum;
        }
        return null;
    }
}


export abstract class Operation10<T extends methods.Operation10> extends Proxy10<T> implements raml.Operation {

    parameters() {
        let initial: raml.Parameter10[] =
            params(this.json.queryParameters, this, "query")
                .concat(params(this.json.headers, this, "headers"));

        if (this.json.queryString) {
            let td = normalizeType(this.json.queryString);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>this.owningFragment(), false);
            let required = this.json.queryString.required;
            initial.push(new Parameter10("queryString", parsedType, required, "queryString", this));
        }
        return initial;
    }

    responses() {
        return mapMap(this, "responses", Response10);
    }
}


export abstract class MethodBase10<T extends methods.MethodBase10> extends Operation10<T> implements raml.MethodBase10 {

    abstract name(): string;

    protocols(){
        if (this.json.protocols){
            return this.json.protocols;
        }
        return []
    }

    abstract securedBy(): raml.SecuredBy[];

    displayName() {
        return this.json.displayName;
    }

    description(){
        return this.json.description;
    }

    parameters() {
        let initial: raml.Parameter10[] =
            params(this.json.queryParameters, this, "query")
                .concat(params(this.json.headers, this, "headers"));

        if (this.json.queryString) {
            let td = normalizeType(this.json.queryString);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>this.owningFragment(), false);
            let required = this.json.queryString.required;
            initial.push(new Parameter10("queryString", parsedType, required, "queryString", this));
        }
        return initial;
    }

    bodies() {
        return bodies(this);
    }

    responses() {
        return mapMap(this, "responses", Response10);
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }
}

export abstract class MethodBase08<T extends methods08.MethodBase08> extends Proxy<T> implements raml.MethodBase08 {

    responses() {
        return mapArray(this, "responses", Response08);
    }

    body(){
        return mapArray(this, "body", BodyLike08);
    }

    protocols(){
        if (this.json.protocols){
            return this.json.protocols;
        }
        return []
    }

    abstract securedBy(): raml.SecuredBy08[];

    parameters() {
        let initial = params08(this.json.queryParameters,this, "query");
        initial = initial.concat(params08(this.json.headers,this, "headers"));
        return initial;
    }

    description(){
        return this.json.description;
    }

}

export class SecuritySchemePart10<T extends security.SecuritySchemePart10> extends Operation10<T> implements raml.SecuritySchemePart10 {

    name(){
        return null;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_PART;
    }
}

export class SecuritySchemePart08<T extends security08.SecuritySchemePart08> extends MethodBase08<T> implements raml.SecuritySchemePart08 {

    name(){
        return null;
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_PART_08;
    }

    securedBy() {
        return mapArray(this, "securedBy", SecuritySchemeDefinition08);
    }
}


export class Method10 extends MethodBase10<methods.Method10> implements raml.Method10 {
    name() {
        return this.json.method
    }

    protocols(){
        if (this.json.protocols){
            return this.json.protocols;
        }
        return []
    }

    securedBy(): raml.SecuredBy[] {
        if (!this.json.securedBy && this.resource()) {
            return this.resource().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition10)
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_METHOD;
    }

    method() {
        return this.json.method;
    }

    parameters() {
        let initial = super.parameters()
                .concat(params(this.json.uriParameters, this, "uriParameters"));
        if(this.resource()) {
            initial = this.resource().allUriParameters().concat(initial);
        }
        return initial;
    }

    resource(): Resource10 {
        if (this.parent && this.parent.kind() == raml.NodeKindMap.NODE_KIND_RESOURCE) {
            return <Resource10>this.parent;
        }
        return null;
    }
}

export class Method08 extends MethodBase08<methods08.Method08> implements raml.Method08 {
    name() {
        return this.json.method
    }

    protocols(){
        if (this.json.protocols){
            return this.json.protocols;
        }
        return []
    }

    securedBy(): raml.SecuredBy08[] {
        if (!this.json.securedBy && this.resource()) {
            return this.resource().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition08);
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_METHOD_08;
    }

    method() {
        return this.json.method;
    }

    parameters() {
        let initial = super.parameters()
            .concat(params08(this.json.uriParameters,this,"uriParameters"));
        return initial;
    }

    resource() {
        if (this.parent && this.parent.kind() == raml.NodeKindMap.NODE_KIND_RESOURCE_08) {
            return <Resource08>this.parent;
        }
        return null;
    }
}

export class Trait10 extends MethodBase10<methods.Trait10> implements raml.Trait10 {

    constructor(json:methods.Trait10, parent: Proxy10<any>) {
        super(json,parent);
    }

    securedBy(): raml.SecuredBy[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition10);
    }

    name(){
        return this.json.name;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_TRAIT;
    }

    isInsideTemplate():boolean{
        return true;
    }
}

export class Trait08 extends MethodBase08<methods08.Trait> implements raml.Trait08 {

    constructor(json:methods08.Trait, parent: Proxy<any>) {
        super(json,parent);
    }

    securedBy(): raml.SecuredBy08[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition08);
    }

    name(){
        return this.json.name;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_TRAIT_08;
    }

    displayName(){
        return this.json.displayName;
    }


    isInsideTemplate():boolean{
        return true;
    }
}

/**
 *
 */
export class Library extends LibraryBase<api.Library> implements raml.Library {

    usage() {
        return this.json.usage;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_LIBRARY;
    }

    name() {
        return "";
    }
}
export class SecuritySchemeDefinition10 extends Proxy10<security.SecuritySchemeBase10> implements raml.SecuritySchemeDefinition10 {

    settings() {
        return this.json.settings;
    }

    type() {
        return this.json.type;
    }

    name() {
        return this.json.name;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_DEFINITION;
    }

    describedBy(){
        if(this.json.describedBy){
            return new SecuritySchemePart10(this.json.describedBy,this);
        }
        return null;
    }
}

export class SecuritySchemeDefinition08 extends Proxy<security08.AbstractSecurityScheme08> implements raml.SecuritySchemeDefinition08 {

    settings() {
        return this.json.settings;
    }

    type() {
        return this.json.type;
    }

    name() {
        return this.json.name;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_DEFINITION_08;
    }

    describedBy(){
        if(this.json.describedBy){
            return new SecuritySchemePart08(this.json.describedBy,this);
        }
        return null;
    }

    description(){
        return this.json.description;
    }
}

export abstract class ResourceBase10<T extends resources.ResourceBase10> extends Proxy10<T> implements raml.ResourceBase10 {

    abstract securedBy(): raml.SecuredBy[];

    displayName() {
        return this.json.displayName;
    }

    description(){
        return this.json.description;
    }

    uriParameters() {
        return params(this.json.uriParameters, this, "uri");
    }

    methods() {
        return mapArray<Method10>(this, "methods", Method10);
    }

    name() {
        return this.json.displayName;
    }

    type(){
        if(this.json.type){
            return new TemplateReference(this.json.type);
        }
        return null;
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }
}

export abstract class ResourceBase08<T extends resources08.ResourceBase08> extends Proxy<T> implements raml.ResourceBase08 {

    abstract securedBy(): raml.SecuredBy08[];

    displayName() {
        return this.json.displayName;
    }

    description(){
        return this.json.description;
    }

    uriParameters() {
        return params08(this.json.uriParameters,this, "uriParameters");
    }

    methods() {
        return mapArray<Method08>(this, "methods", Method08);
    }

    name() {
        return this.json.displayName;
    }

    type(){
        if(this.json.type){
            return new TemplateReference(this.json.type);
        }
        return null;
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }

    baseUriParameters(){
        return params08(this.json.baseUriParameters,this, "baseUriParameters");
    }
}

export class Resource10 extends ResourceBase10<resources.Resource10> implements raml.Resource10 {

    securedBy(): raml.SecuredBy[] {
        if (!this.json.securedBy && this.owningApi()) {
            return this.owningApi().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition10);
    }

    relativeUri() {
        return this.json.relativeUri;
    }

    completeRelativeUri() {
        return completeRelativeUri(this);
    }

    absoluteUri() {
        return absoluteUri(this,this);
    }

    parentUri() {
        const pResource = this.parentResource();
        if(pResource){
            return completeRelativeUri(pResource);
        }
        return "";
    }

    absoluteParentUri() {
        return absoluteUri(this.parentResource(),this);
    }

    parentResource(): raml.Resource10 {
        if (this.parent.kind() == raml.NodeKindMap.NODE_KIND_RESOURCE) {
            return <Resource10>this.parent;
        }
        return null;
    }

    allUriParameters() {
        const ownUriParameters:raml.Parameter10[] = this.uriParameters();
        let parentParameters:raml.Parameter10[] = [];
        const paramsMap:{[key:string]:boolean} = {};
        ownUriParameters.forEach(x=>paramsMap[x.name()]=true);
        let p = this.parentResource();
        if (p) {
            parentParameters = p.allUriParameters();
        }
        else if(this.owningApi()){
            parentParameters = this.owningApi().baseUriParameters();
        }
        parentParameters = parentParameters.filter(x=>!paramsMap[x.name()]);
        return ownUriParameters.concat(parentParameters);
    }

    resources(): raml.Resource10[] {
        return mapArray<Resource10>(this, "resources", Resource10);
    }

    owningApi() {
        return <raml.Api10><any>this.owningFragment();
    }

    relativeUriPathSegments(){
        const relUri = this.relativeUri();
        if(relUri) {
            let segments = relUri.trim().split("/");
            while (segments.length > 0 && segments[0].length == 0) {
                segments.shift();
            }
            return segments;
        }
        return null;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_RESOURCE;
    }
}

export class Resource08 extends ResourceBase08<resources08.Resource08> implements raml.Resource08 {

    securedBy(): raml.SecuredBy08[] {
        // if (!this.json.securedBy && this.owningApi()) {
        //     return this.owningApi().securedBy();
        // }
        return mapArray(this, "securedBy", SecuritySchemeDefinition08);
    }

    relativeUri() {
        return this.json.relativeUri;
    }

    completeRelativeUri() {
        return completeRelativeUri(this);
    }

    absoluteUri() {
        return absoluteUri(this,this);
    }

    parentUri() {
        const pResource = this.parentResource();
        if(pResource){
            return completeRelativeUri(pResource);
        }
        return "";
    }

    absoluteParentUri() {
        return absoluteUri(this.parentResource(),this);
    }

    parentResource(): raml.Resource08 {
        if (this.parent.kind() == raml.NodeKindMap.NODE_KIND_RESOURCE_08) {
            return <Resource08>this.parent;
        }
        return null;
    }

    allUriParameters() {
        return null;
    }

    resources(): raml.Resource08[] {
        return mapArray<Resource08>(this, "resources", Resource08);
    }

    owningApi() {
        return <raml.Api08><any>this.root();
    }

    relativeUriPathSegments(){
        const relUri = this.relativeUri();
        if(relUri) {
            let segments = relUri.trim().split("/");
            while (segments.length > 0 && segments[0].length == 0) {
                segments.shift();
            }
            return segments;
        }
        return null;
    }

    kind() {
        return raml.NodeKindMap.NODE_KIND_RESOURCE_08;
    }
}

export class ResourceType10 extends ResourceBase10<resources.ResourceType10> implements raml.ResourceType10 {

    constructor(json:resources.ResourceType10, parent: Proxy10<any>) {
        super(json,parent);
    }

    securedBy(): raml.SecuredBy[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition10);
    }

    name(){
        return this.json.name;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_RESOURCE_TYPE;
    }

    isInsideTemplate():boolean{
        return true;
    }
}

export class ResourceType08 extends ResourceBase08<resources08.ResourceType08> implements raml.ResourceType08 {

    constructor(json:resources08.ResourceType08, parent: Proxy<any>) {
        super(json,parent);
    }

    securedBy(): raml.SecuredBy08[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition08);
    }

    name(){
        return this.json.name;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_RESOURCE_TYPE_08;
    }

    isInsideTemplate():boolean{
        return true;
    }
}

export class ResourceTypeFragment extends ResourceType10 implements raml.ResourceTypeFragment{

    constructor(
        json:resources.ResourceType10,
        protected _errors: common.Error[] = []) {
        super(json,null);
    }

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    errors(){
        return this._errors;
    }
}

export class TraitFragment extends Trait10 implements raml.TraitFragment{

    constructor(
        json:methods.Trait10,
        protected _errors: common.Error[] = []) {
        super(json,null);
    }

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    errors(){
        return this._errors;
    }
}

export class SecuritySchemeFragment extends SecuritySchemeDefinition10 implements raml.SecuritySchemeFragment{

    constructor(
        json:security.SecuritySchemeBase10,
        protected _actualKind:string,
        protected _errors: common.Error[] = []) {
        super(json,null);
    }

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    actualKind(){
        return this._actualKind;
    }

    errors(){
        return this._errors;
    }
}

export class TypeFragment extends FragmentBase<datamodel.TypeDeclarationFragment> implements raml.TypeFragment{

    constructor(
        json: datamodel.TypeDeclarationFragment,
        protected _isAnnotation:boolean,
        protected _actualKind:string,
        errors:common.Error[] = []) {
        super(json,ts.parseJSONTypeCollection(json),errors);
    }

    name(){
        return this.json.name;
    }

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    type(){
        let name = this.json.name || "";
        let td = normalizeType(this.json);
        let parsedType = ts.parseJsonTypeWithCollection(name, td, <any>this, true);
        return parsedType;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_TYPE_DECLARATION;
    }

    isAnnotation(){
        return this._isAnnotation;
    }

    actualKind(){
        return this._actualKind;
    }
}

export class ExampleSpecFragment extends Proxy10<datamodel.ExampleSpec10> implements raml.ExampleSpecFragment{

    constructor(
        json: datamodel.ExampleSpec10,
        protected _errors:common.Error[] = []) {
        super(json,null);
    }

    name(){
        return this.json.name;
    }

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }

    value(){
        return this.json.value;
    }

    displayName(){
        return this.json.displayName;
    }

    description(){
        return this.json.description;
    }

    strict(){
        return this.json.strict;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_EXAMPLE_SPEC;
    }

    errors(){
        return this._errors;
    }
}

export function load(json:root.RAMLParseResult):raml.Fragment|raml.Api08{
    if(!json){
        return null;
    }
    const hasDetails = json.hasOwnProperty("ramlVersion")
        && json.hasOwnProperty("type")
        && json.hasOwnProperty("specification");

    const specType = hasDetails ? json.type : "Api";
    const specBody = hasDetails ? json.specification : json;
    const errors = hasDetails ? json.errors : [];
    const ramlVersion = hasDetails ? json.ramlVersion : "RAML10";

    if(ramlVersion=="RAML08"){
        return new Api08(specBody, errors);
    }
    else {
        let nm = normalize(<api.LibraryBase10>specBody);
        let collection: ti.IParsedTypeCollection;
        if (["Api", "Overlay", "Extension", "Library"].indexOf(specType) >= 0) {
            collection = ts.parseJSONTypeCollection(nm);
        }
        if (specType == "Overlay") {
            return new Overlay(specBody, collection, errors);
        }
        else if (specType == "Extension") {
            return new Extension(specBody, collection, errors);
        }
        else if (specType == "Library") {
            return new Library(specBody, collection, errors);
        }
        else if (specType == "ResourceType") {
            return new ResourceTypeFragment(<resources.ResourceType10>specBody, errors);
        }
        else if (specType == "Trait") {
            return new TraitFragment(<methods.Trait10>specBody, errors);
        }
        else if (specType == "ExampleSpec") {
            return new ExampleSpecFragment(<datamodel.ExampleSpec10>specBody, errors);
        }
        else if (specType.indexOf("Type") >= 0) {
            let isAnnotation = specType.indexOf("Annotation") >= 0;
            return new TypeFragment(<datamodel.TypeDeclarationFragment>specBody, isAnnotation, specType, errors);
        }
        else if (specType.indexOf("SecurityScheme") >= 0) {
            return new SecuritySchemeFragment(<security.SecuritySchemeBase10>specBody, specType, errors);
        }
        return new Api10(specBody, collection, errors);
    }
}

export function loadApi(api: api.Api10): raml.Api10 {
    let nm = normalize(api);
    let collection = ts.parseJSONTypeCollection(nm);
    return new Api10(api, collection);
}

export function loadLibrary(api: api.Library): raml.Library {
    let nm = normalize(api);
    let collection = ts.parseJSONTypeCollection(nm);
    return new Library(api, collection);
}

export function toTypeDeclaration(
    json:datamodel.TypeDeclaration,
    collection:ti.IParsedTypeCollection,
    defaultsToAny=false):ti.IParsedType{

    let td = normalizeType(json);
    let parsedType = ts.parseJsonTypeWithCollection("", td, collection, defaultsToAny);
    return parsedType;
}

export function completeRelativeUri(res:raml.Resource10|raml.Resource08):string{
    let uri = '';
    let parent = res;
    do{
        res = parent;
        uri = res.relativeUri() + uri;
        parent = res.parentResource();
    }
    while (parent);
    uri = uri.replace(/\/\//g,'/');
    return uri;
}

export function absoluteUri(res:raml.Resource10|raml.Resource08, fragmentSrc:raml.Resource10|raml.Resource08):string{

    let uri = '';
    if(res) {
        let parent = res;
        do {
            res = parent;
            uri = res.relativeUri() + uri;
            parent = res.parentResource();
        }
        while (parent);
        uri = uri.replace(/\/\//g, '/');
    }
    let api:raml.Api08|raml.IAnnotated;
    if(fragmentSrc.kind()==raml.NodeKindMap.NODE_KIND_RESOURCE_08){
        api = (<raml.Resource08>fragmentSrc).owningApi();
    }
    else {
        api = (<raml.Resource10>fragmentSrc).owningFragment();
    }
    if(api &&(
        api.kind() == raml.NodeKindMap.NODE_KIND_API
            || api.kind() == raml.NodeKindMap.NODE_KIND_OVERLAY
            || api.kind() == raml.NodeKindMap.NODE_KIND_EXTENSION
            || api.kind() == raml.NodeKindMap.NODE_KIND_API_08
        )){
        let baseUri = (<raml.Api10|raml.Api08>api).baseUri();
        if(baseUri){
            baseUri = baseUri.trim();
            if(baseUri.charAt(baseUri.length-1)=="/"&& uri && uri.charAt(0)=="/"){
                uri = uri.substring(1);
            }
            uri = baseUri + uri;
        }
    }
    return uri;
}

export class TemplateReference implements raml.TemplateReference{

    constructor(private json: methods.TemplateReference){}

    name(){
        return this.json.name;
    }

    parameters(){
        return this.json.parameters;
    }
}

type fragmentConstructor = (specBody:any,collection?:ti.IParsedTypeCollection)=> raml.Fragment;

export class GlobalSchema extends Proxy<api08.GlobalSchema> implements raml.GlobalSchema{

    name(){
        return this.json.name;
    }

    schemaValue(){
        return this.json.value;
    }

    sourceMap(){
        return <ti.ElementSourceInfo>this.json.sourceMap;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_GLOBAL_SCHEMA_08;
    }
}