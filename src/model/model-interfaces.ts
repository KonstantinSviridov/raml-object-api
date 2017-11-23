import index = require("../index");
import ts = index.typesystem;
import tsInterfaces = ts.tsInterfaces;
export import IAnnotation=tsInterfaces.IAnnotation;
export import Facet = tsInterfaces.ITypeFacet;
import common = require("../typings-new-format/spec-1.0/common");

export const NodeKindMap:{[key:string]:string} = {
    NODE_KIND_DOCUMENTATION: "Documentation",
    NODE_KIND_API: "Api",
    NODE_KIND_OVERLAY: "Overlay",
    NODE_KIND_EXTENSION: "Extension",
    NODE_KIND_RESPONSE: "Response",
    NODE_KIND_METHOD: "Method",
    NODE_KIND_TRAIT: "Trait",
    NODE_KIND_BODY: "Body",
    NODE_KIND_PARAMETER: "Parameter",
    NODE_KIND_LIBRARY: "Library",
    NODE_KIND_SECURITY_SCHEME_DEFINITION: "SecurityScheme",
    NODE_KIND_RESOURCE: "Resource",
    NODE_KIND_RESOURCE_TYPE: "ResourceType",
    NODE_KIND_SECURITY_SCHEME_PART: "SecuritySchemePart",
    NODE_KIND_USES_DECLARATION: "UsesDeclaration",
    NODE_KIND_TYPE_DECLARATION: "TypeDeclaration",
    NODE_KIND_EXAMPLE_SPEC: "ExampleSpec",
    NODE_KIND_API_08: "Api08",
    NODE_KIND_RESPONSE_08: "Response08",
    NODE_KIND_METHOD_08: "Method08",
    NODE_KIND_TRAIT_08: "Trait08",
    NODE_KIND_BODYLIKE_08: "BodyLike08",
    NODE_KIND_PARAMETER_08: "Parameter08",
    NODE_KIND_SECURITY_SCHEME_DEFINITION_08: "SecurityScheme08",
    NODE_KIND_RESOURCE_08: "Resource08",
    NODE_KIND_RESOURCE_TYPE_08: "ResourceType08",
    NODE_KIND_SECURITY_SCHEME_PART_08: "SecuritySchemePart08",
    NODE_KIND_GLOBAL_SCHEMA_08: "GlobalSchema08"
};

export interface IAnnotated {

    annotations(): IAnnotation[]

    annotation(name: string): any

    scalarsAnnotations():{[key:string]:IAnnotation[][]}

    owningFragment(): IAnnotated

    kind(): string

    isInsideTemplate():boolean
}

export interface HasSource10 extends IAnnotated, tsInterfaces.HasSource {
    metadata():any

    parametrizedPart():any
}

export interface HasSource08 extends tsInterfaces.HasSource {
    metadata():any

    kind():string

    parametrizedPart():any

    isInsideTemplate():boolean
}

export interface SecuritySchemeDefinition10 extends HasSource10 {

    name(): string

    type(): string

    description(): string

    settings(): {[name: string]: any}

    describedBy(): SecuritySchemePart10;
}

export interface SecuritySchemeDefinition08 extends HasSource08{

    name(): string

    type(): string

    description(): string

    describedBy(): SecuritySchemePart08

    settings(): Object
}

export type SecuredBy = SecuritySchemeDefinition10;

export type SecuredBy08 = SecuritySchemeDefinition08;


export interface Documentation10 extends HasSource10 {
    title(): string
    content(): string;
}
export interface Documentation08 extends HasSource08 {
    title(): string
    content(): string;
}
export interface Api10 extends LibraryBase {

    title(): string

    baseUri(): string

    version(): string

    description(): string

    documentation(): Documentation10[]

    resources(): Resource10[]

    allResources(): Resource10[]

    allMethods(): Method10[];

    securedBy(): SecuredBy[]

    protocols(): string[]

    mediaType(): string[]

    baseUriParameters(): Parameter10[];
}

export interface Api08 extends HasSource08 {

    title(): string

    version(): string

    baseUri(): string

    baseUriParameters(): Parameter08[]

    protocols(): string[]

    mediaType(): string

    schemas(): GlobalSchema[]

    traits(): Trait08[]

    securedBy(): SecuritySchemeDefinition08[]

    securitySchemes(): SecuritySchemeDefinition08[]

    resourceTypes(): ResourceType08[]

    resources(): Resource08[]

    documentation(): Documentation08[]

    errors():common.Error[]
}

export interface Overlay extends Api10 {

    extends():string

    usage():string
}

export interface Extension extends Api10 {

    extends():string

    usage():string
}

export interface Fragment extends HasSource10{
    uses(): UsesDeclaration[]

    errors():common.Error[]
}

export interface UsesDeclaration extends HasSource10{

    key(): string

    path(): string

    usage(): string
}

export interface LibraryBase extends Fragment,HasSource10,tsInterfaces.IParsedTypeCollection {

    securitySchemes(): SecuritySchemeDefinition10[]

    types(): tsInterfaces.IParsedType[]

    annotationTypes(): tsInterfaces.IParsedType[]

    traits(): Trait10[]

    resourceTypes(): ResourceType10[]
}


export interface Library extends LibraryBase {

    usage(): string
}

export interface ResourceBase10 extends HasSource10 {

    displayName():string

    description():string

    securedBy(): SecuredBy[]

    methods(): Method10[]

    uriParameters(): Parameter10[];

    type():TemplateReference;

    is():TemplateReference[];
}

export interface ResourceBase08 extends HasSource08{

    is(): TemplateReference[]

    type(): TemplateReference

    securedBy(): SecuredBy08[]

    uriParameters(): Parameter08[]

    displayName(): string

    baseUriParameters(): Parameter08[]

    description(): string

    methods(): Method08[]
}

export interface Resource10 extends ResourceBase10 {

    relativeUri(): string;

    completeRelativeUri(): string;

    absoluteUri(): string;

    parentUri(): string;

    absoluteParentUri(): string;

    parentResource(): Resource10

    resources(): Resource10[]

    relativeUriPathSegments():string[]

    allUriParameters(): Parameter10[];

    owningApi(): Api10
}

export interface Resource08 extends ResourceBase08{

    relativeUri():string

    relativeUriPathSegments(): string[]

    resources(): Resource08[]

    absoluteUri(): string

    completeRelativeUri(): string

    parentUri(): string

    absoluteParentUri(): string

    parentResource():Resource08

    owningApi():Api08

    allUriParameters():Parameter08[]
}

export interface ResourceType10 extends ResourceBase10 {

    name(): string

    usage(): string
}

export interface ResourceType08 extends ResourceBase08 {

    name(): string

    usage(): string
}

export interface Operation extends HasSource10 {

    parameters(): Parameter10[]; //

    responses(): Response10[] //
}

export interface SecuritySchemePart10 extends Operation {

}

export interface SecuritySchemePart08 extends MethodBase08{

    is(): TemplateReference[]
}

export interface MethodBase10 extends Operation {

    name(): string

    securedBy(): SecuredBy[]

    displayName(): string //

    description(): string //

    bodies(): Body10[]; //

    protocols():string[]

    is():TemplateReference[];
}

export interface MethodBase08 extends HasSource08 {

    responses(): Response08[]

    body(): BodyLike08[]

    protocols(): string[]

    securedBy(): SecuritySchemeDefinition08[]

    parameters(): Parameter08[]

    description(): string
}

export interface Method10 extends MethodBase10 {

    method(): string //

    resource(): Resource10 //
}

export interface Method08 extends MethodBase08{

    method(): string

    resource(): Resource08

    is(): TemplateReference[]
}

export interface Trait10 extends MethodBase10 {

    usage(): string
}

export interface Trait08 extends MethodBase08{

    name(): string

    usage(): string

    displayName(): string
}

export interface Response10 extends HasSource10 {

    code(): string //

    headers(): Parameter10[] //

    bodies(): Body10[] //

    method(): Method10 //

    description(): string
}

export interface Response08 extends HasSource08 {

    code(): string //

    headers(): Parameter08[] //

    bodies(): BodyLike08[] //

    method(): Method08 //

    description(): string
}

export interface Parameter10 extends IAnnotated {

    name(): string  //

    required(): boolean //

    type(): tsInterfaces.IParsedType //

    location(): string //

    meta():any
}

export interface Parameter08 extends HasSource08 {

    name(): string

    required(): boolean

    type(): string

    location(): string

    displayName():string

    default(): any

    example(): string

    repeat(): boolean

    description(): string

    pattern(): string

    enum():string[]

    minLength(): number

    maxLength(): number

    minimum(): number

    maximum(): number
}


export interface Body10 extends IAnnotated {

    mimeType(): string //

    type(): tsInterfaces.IParsedType //

    meta():any
}

export interface BodyLike08 extends HasSource08{

    name():string

    mimeType(): string

    schema(): string

    example(): string|number|boolean

    formParameters(): Parameter08[]

    schemaContent():string

    description(): string
}

export interface TemplateReference{

    name(): string

    parameters(): {
        name: string
        value: any
    }[]
}

export interface ResourceTypeFragment extends ResourceType10, Fragment{}

export interface TraitFragment extends Trait10, Fragment{}

export interface SecuritySchemeFragment extends SecuritySchemeDefinition10, Fragment{
    actualKind():string;
}

export interface TypeFragment extends Fragment{

    type():tsInterfaces.IParsedType;

    isAnnotation():boolean;

    actualKind():string;
}

export interface ExampleSpecFragment extends Fragment{

    name():string;

    value():any;

    strict():boolean;

    displayName():string;

    description():string;
}

export interface GlobalSchema extends tsInterfaces.HasSource{

    name():string

    schemaValue():string
}