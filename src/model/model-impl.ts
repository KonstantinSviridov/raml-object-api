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
    serializeAnnotations(e,ex);
    return ex;
};

function serializeAnnotations(t:{
    annotations?: common.AnnotationInstance[]
}, res: any) {
    if (t.annotations) {
        for (let x of t.annotations) {
            res[`(${x.name})`] = x.value;
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
        if(t.type && t.type.length){
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
            else {
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
        serializeAnnotations(t, res);
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
            res.items = normalizeType(items[0]);
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

export abstract class Proxy<JSONType extends common.Annotable> extends Annotated implements ti.IAnnotatedElement, raml.HasSource {

    constructor(public readonly json: JSONType, public readonly parent: Proxy<any>) {
        super();
    }

    abstract name();

    abstract kind();

    owningFragment(): FragmentBase<any> {
        if (this.parent) {
            return this.parent.owningFragment();
        }
        if (this instanceof FragmentBase) {
            return <any>this;
        }
        return null;
    }

    description() {
        return (<any>this.json).description || (<any>this.json).usage
    }

    annotationsMap() {
        return null;
    }

    private _annotations;

    private _scalarsAnnotations;

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

    value() {
        return this.json;
    }

    entry() {
        return this.json;
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

    sourceMap(){
        return <ti.ElementSourceInfo>this.json.sourceMap;
    }

    metadata():any{
        return this.json.__METADATA__;
    }
}

export class Annotation extends Proxy<common.AnnotationInstance> implements raml.IAnnotation {


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

export abstract class FragmentBase<T> extends Proxy<T> implements raml.Fragment{


    constructor(node: any, private tc: ti.IParsedTypeCollection) {
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
}

export class UsesDeclaration extends Proxy<common.UsesDeclaration> implements raml.UsesDeclaration{

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

function gatherResources(r: raml.Api|raml.Resource, res: raml.Resource[]) {
    let resources: raml.Resource[] = r.resources();
    resources.forEach(x => {
        res.push(x);
        gatherResources(x, res);
    })
}
export abstract class LibraryBase<T> extends FragmentBase<T> {

    securitySchemes() {
        return mapArrayMaps<SecuritySchemeDefinition>(this, "securitySchemes", SecuritySchemeDefinition);
    }

    add(t:ti.IParsedType): void{

    }

    addAnnotationType(t:ti.IParsedType): void{

    }

    library(name: string): ti.IParsedTypeCollection{
        return null;
    }

    traits(){
        return mapArray<Trait>(this, "traits", Trait);
    }

    resourceTypes(){
        return mapArray<ResourceType>(this, "resourceTypes", ResourceType);
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
export class Documentation extends  Proxy<api.DocumentationItem>{

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
        return raml.NodeKindMap.RAML_KIND_DOCUMENTATION
    }
}

export class Api<T extends api.Api10 = api.Api10> extends LibraryBase<T> implements raml.Api {

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
        return mapArray(this, "securedBy", SecuritySchemeDefinition)
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
        return raml.NodeKindMap.RAML_KIND_API;
    }

    resources() {
        return mapArray<Resource>(this, "resources", Resource);
    }

    allResources() {
        let res: raml.Resource[] = []
        gatherResources(this, res);
        return res;
    }

    allMethods() {
        let meth: raml.Method[] = [];
        this.allResources().forEach(x => {
            meth = meth.concat(x.methods());
        })
        return meth;
    }
}

export class Overlay extends Api<api.Overlay> implements raml.Overlay{

    extends(){
        return this.json.extends;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.RAML_KIND_OVERLAY;
    }
}

export class Extension extends Api<api.Extension> implements raml.Extension{

    extends(){
        return this.json.extends;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.RAML_KIND_EXTENSION;
    }
}

function bodies(t: MethodBase<any>|Response) {
    if (!t.json.body) {
        return [];
    }
    let result: Body[] = []
    for(let x of t.json.body){
        let name = x.name;
        let td = normalizeType(x);
        let parsedType = ts.parseJsonTypeWithCollection("", td, <any>t.owningFragment(), true);
        let meta:any;
        if(!parsedType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata).length){
            meta = x.__METADATA__;
        }
        result.push(new Body(name, parsedType, t, meta));
    }
    return result;
}

function params(v: datamodel.TypeDeclaration[], parent: Proxy<any>, location: string) {

    let result: Parameter[] = [];
    if (v && v.length>0) {
        for( let x of v){
            let td = normalizeType(x);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>parent.owningFragment(), false);
            let required = x.required;
            let meta:any;
            if(!parsedType.declaredFacets().filter(x=>x.kind()==ti.MetaInformationKind.ParserMetadata).length){
                meta = x.__METADATA__;
            }
            result.push(new Parameter(x.name, parsedType, required, location, parent,meta));
        }
    }
    return result;
}

export class Response extends Proxy<methods.Response10> implements raml.Response {
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
        return <Method>this.parent;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_RESPONSE;
    }
}
export class Body extends Annotated implements raml.Body {

    constructor(private mime: string, private p: ti.IParsedType, private owner:raml.MethodBase|raml.Response, private _meta?:any) {
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
        return raml.NodeKindMap.RAML_KIND_BODY;
    }

    meta(){
        return this._meta;
    }
}
export class Parameter extends  Annotated implements raml.Parameter {

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
        return raml.NodeKindMap.RAML_KIND_PARAMETER;
    }

    meta():any{
        return this._meta;
    }
}

export abstract class Operation<T extends methods.Operation10> extends Proxy<T> implements raml.Operation {

    parameters() {
        let initial: raml.Parameter[] =
            params(this.json.queryParameters, this, "query")
                .concat(params(this.json.headers, this, "headers"));

        if (this.json.queryString) {
            let td = normalizeType(this.json.queryString);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>this.owningFragment(), false);
            let required = this.json.queryString.required;
            initial.push(new Parameter("queryString", parsedType, required, "queryString", this));
        }
        return initial;
    }

    responses() {
        return mapMap(this, "responses", Response);
    }
}

export class SecuritySchemePart<T extends security.SecuritySchemePart10> extends Operation<T> implements raml.SecuritySchemePart {

    name(){
        return null;
    }

    kind(){
        return raml.NodeKindMap.NODE_KIND_SECURITY_SCHEME_PART;
    }
}


export abstract class MethodBase<T extends methods.MethodBase10> extends Operation<T> implements raml.MethodBase {

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
        let initial: raml.Parameter[] =
            params(this.json.queryParameters, this, "query")
                .concat(params(this.json.headers, this, "headers"));

        if (this.json.queryString) {
            let td = normalizeType(this.json.queryString);
            let parsedType = ts.parseJsonTypeWithCollection("", td, <any>this.owningFragment(), false);
            let required = this.json.queryString.required;
            initial.push(new Parameter("queryString", parsedType, required, "queryString", this));
        }
        return initial;
    }

    bodies() {
        return bodies(this);
    }

    responses() {
        return mapMap(this, "responses", Response);
    }

    is() {
        return this.json.is && this.json.is.map(x=>new TemplateReference(x));
    }
}

export class Method extends MethodBase<methods.Method10> implements raml.Method {
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
        return mapArray(this, "securedBy", SecuritySchemeDefinition)
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_METHOD;
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

    resource(): Resource {
        if (this.parent && this.parent.kind() == raml.NodeKindMap.RAML_KIND_RESOURCE) {
            return <Resource>this.parent;
        }
        return null;
    }
}

export class Trait extends MethodBase<methods.Trait10> implements raml.Trait {

    securedBy(): raml.SecuredBy[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition);
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
}

/**
 *
 */
export class Library extends LibraryBase<api.Library> implements raml.Library {

    usage() {
        return this.json.usage;
    }

    kind() {
        return raml.NodeKindMap.RAML_KIND_LIBRARY;
    }

    name() {
        return "";
    }
}
export class SecuritySchemeDefinition extends Proxy<security.SecuritySchemeBase10> implements raml.SecuritySchemeDefinition {

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
        return raml.NodeKindMap.RAML_KIND_SECURITY_SCHEME_DEFINITION;
    }

    describedBy(){
        if(this.json.describedBy){
            return new SecuritySchemePart(this.json.describedBy,this);
        }
        return null;
    }
}

export abstract class ResourceBase<T extends resources.ResourceBase10> extends Proxy<T> implements raml.ResourceBase {

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
        return mapArray<Method>(this, "methods", Method);
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

export class Resource extends ResourceBase<resources.Resource10> implements raml.Resource {

    securedBy(): raml.SecuredBy[] {
        if (!this.json.securedBy && this.owningApi()) {
            return this.owningApi().securedBy();
        }
        return mapArray(this, "securedBy", SecuritySchemeDefinition);
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

    parentResource(): raml.Resource {
        if (this.parent.kind() == raml.NodeKindMap.RAML_KIND_RESOURCE) {
            return <Resource>this.parent;
        }
        return null;
    }

    allUriParameters() {
        const ownUriParameters:raml.Parameter[] = this.uriParameters();
        let parentParameters:raml.Parameter[] = [];
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

    resources(): raml.Resource[] {
        return mapArray<Resource>(this, "resources", Resource);
    }

    owningApi() {
        return <raml.Api><any>this.owningFragment();
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
        return raml.NodeKindMap.RAML_KIND_RESOURCE;
    }
}

export class ResourceType extends ResourceBase<resources.ResourceType10> implements raml.ResourceType {

    securedBy(): raml.SecuredBy[] {
        return mapArray(this, "securedBy", SecuritySchemeDefinition);
    }

    name(){
        return this.json.name;
    }

    usage(){
        return this.json.usage;
    }

    kind(){
        return raml.NodeKindMap.RAML_KIND_RESOURCE_TYPE;
    }
}

export class ResourceTypeFragment extends ResourceType implements raml.ResourceTypeFragment{

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }
}

export class TraitFragment extends Trait implements raml.TraitFragment{

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }
}

export class SecuritySchemeFragment extends SecuritySchemeDefinition implements raml.SecuritySchemeFragment{

    uses(){
        return mapArray<UsesDeclaration>(this, "uses", UsesDeclaration);
    }
}

export function load(json:root.RAMLParseResult):raml.Fragment{
    if(!json){
        return null;
    }
    const hasDetails = json.hasOwnProperty("ramlVersion")
        && json.hasOwnProperty("type")
        && json.hasOwnProperty("specification");

    const specType = hasDetails ? json.type : "Api";
    const specBody = hasDetails ? json.specification : json;

    let collection:ti.IParsedTypeCollection;
    if( ["Api", "Overlay", "Extension", "Library"].indexOf(specType)>=0) {
        let nm = normalize(<api.LibraryBase10>specBody);
        collection = ts.parseJSONTypeCollection(nm);
    }
    if(specType == "Overlay"){
        return new Overlay(specBody, collection);
    }
    else if(specType == "Extension"){
        return new Extension(specBody, collection);
    }
    else if(specType == "Library"){
        return new Library(specBody, collection);
    }
    else if(specType == "ResourceType"){
        return new ResourceTypeFragment(<resources.ResourceType10>specBody, null);
    }
    else if(specType == "Trait"){
        return new TraitFragment(<methods.Trait10>specBody, null);
    }
    else if(specType.indexOf("SecurityScheme")>=0){
        return new SecuritySchemeFragment(<security.SecuritySchemeBase10>specBody, null);
    }
    return new Api(specBody, collection);
}

export function loadApi(api: api.Api10): raml.Api {
    let nm = normalize(api);
    let collection = ts.parseJSONTypeCollection(nm);
    return new Api(api, collection);
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

export function completeRelativeUri(res:raml.Resource):string{
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

export function absoluteUri(res:raml.Resource,fragmentSrc:raml.Resource):string{

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
    let api = fragmentSrc.owningFragment();
    if(api &&(
        api.kind() == raml.NodeKindMap.RAML_KIND_API
            || api.kind() == raml.NodeKindMap.RAML_KIND_OVERLAY
            || api.kind() == raml.NodeKindMap.RAML_KIND_EXTENSION
        )){
        let baseUri = (<raml.Api>api).baseUri();
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
