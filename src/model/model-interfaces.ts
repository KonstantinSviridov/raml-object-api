import index = require("../index");
import ts = index.typesystem;
import tsInterfaces = ts.tsInterfaces;
export import IAnnotation=tsInterfaces.IAnnotation;
export import Facet = tsInterfaces.ITypeFacet;

export const NodeKindMap:{[key:string]:string} = {
    RAML_KIND_DOCUMENTATION: "Documentation",
    RAML_KIND_API: "Api",
    RAML_KIND_OVERLAY: "Overlay",
    RAML_KIND_EXTENSION: "Extension",
    RAML_KIND_RESPONSE: "Response",
    RAML_KIND_METHOD: "Method",
    NODE_KIND_TRAIT: "Trait",
    RAML_KIND_BODY: "Body",
    RAML_KIND_PARAMETER: "Parameter",
    RAML_KIND_LIBRARY: "Library",
    RAML_KIND_SECURITY_SCHEME_DEFINITION: "SecurityScheme",
    RAML_KIND_RESOURCE: "Resource",
    RAML_KIND_RESOURCE_TYPE: "ResourceType",
    NODE_KIND_SECURITY_SCHEME_PART: "SecuritySchemePart",
    NODE_KIND_USES_DECLARATION: "UsesDeclaration"
};

export interface IAnnotated {

    annotations(): IAnnotation[]

    annotation(name: string): any

    scalarsAnnotations():{[key:string]:IAnnotation[][]}

    owningFragment(): IAnnotated

    kind(): string
}

export interface HasSource extends IAnnotated, tsInterfaces.HasSource {
    metadata():any
}
export interface SecuritySchemeDefinition extends HasSource {

    name(): string

    type(): string

    description(): string

    settings(): {[name: string]: any}

    describedBy(): SecuritySchemePart;
}

export type SecuredBy = SecuritySchemeDefinition;


export interface Documentation extends HasSource {
    title(): string
    content(): string;
}
export interface Api extends LibraryBase {

    title(): string

    baseUri(): string

    version(): string

    description(): string

    documentation(): Documentation[]

    resources(): Resource[]

    allResources(): Resource[]

    allMethods(): Method[];

    securedBy(): SecuredBy[]

    protocols(): string[]

    mediaType(): string[]

    baseUriParameters(): Parameter[];
}

export interface Overlay extends Api {

    extends():string

    usage():string
}

export interface Extension extends Api {

    extends():string

    usage():string
}

export interface Fragment extends HasSource{
    uses(): UsesDeclaration[]
}

export interface UsesDeclaration extends HasSource{

    key(): string

    path(): string

    usage(): string
}

export interface LibraryBase extends Fragment,HasSource,tsInterfaces.IParsedTypeCollection {

    securitySchemes(): SecuritySchemeDefinition[]

    types(): tsInterfaces.IParsedType[]

    annotationTypes(): tsInterfaces.IParsedType[]

    traits(): Trait[]

    resourceTypes(): ResourceType[]
}


export interface Library extends LibraryBase {

    usage(): string
}

export interface ResourceBase extends HasSource {

    displayName():string

    description():string

    securedBy(): SecuredBy[]

    methods(): Method[]

    uriParameters(): Parameter[];

    type():TemplateReference;

    is():TemplateReference[];
}

export interface Resource extends ResourceBase {

    relativeUri(): string;

    completeRelativeUri(): string;

    absoluteUri(): string;

    parentUri(): string;

    absoluteParentUri(): string;

    parentResource(): Resource

    resources(): Resource[]

    relativeUriPathSegments():string[]

    allUriParameters(): Parameter[];

    owningApi(): Api
}

export interface ResourceType extends ResourceBase {

    name(): string

    usage(): string
}

export interface Operation extends HasSource {

    parameters(): Parameter[]; //

    responses(): Response[] //
}

export interface SecuritySchemePart extends Operation {

}

export interface MethodBase extends Operation {

    name(): string

    securedBy(): SecuredBy[]

    displayName(): string //

    description(): string //

    bodies(): Body[]; //

    protocols():string[]

    is():TemplateReference[];
}

export interface Method extends MethodBase {

    method(): string //

    resource(): Resource //
}

export interface Trait extends MethodBase {

    usage(): string
}

export interface Response extends HasSource {

    code(): string //

    headers(): Parameter[] //

    bodies(): Body[] //

    method(): Method //

    description(): string
}

export interface Parameter extends IAnnotated {

    name(): string  //

    required(): boolean //

    type(): tsInterfaces.IParsedType //

    location(): string //

    meta():any
}

export interface Body extends IAnnotated {

    mimeType(): string //

    type(): tsInterfaces.IParsedType //

    meta():any
}

export interface TemplateReference{

    name(): string

    parameters(): {
        name: string
        value: any
    }[]
}

export interface ResourceTypeFragment extends ResourceType, Fragment{}

export interface TraitFragment extends Trait, Fragment{}

export interface SecuritySchemeFragment extends SecuritySchemeDefinition, Fragment{}
