import index = require("../index");
import ts = index.typesystem;
import tsInterfaces = ts.tsInterfaces;
export import IAnnotation=tsInterfaces.IAnnotation;
export import Facet = tsInterfaces.ITypeFacet;

export const NodeKindMap:{[key:string]:string} = {
    RAML_KIND_DOCUMENTATION: "Documentation",
    RAML_KIND_API: "Api",
    RAML_KIND_RESPONSE: "Response",
    RAML_KIND_METHOD: "Method",
    RAML_KIND_LIBRARY: "Library",
    RAML_KIND_SECURITY_SCHEME_DEFINITION: "SecuritySchemeDefinition",
    RAML_KIND_RESOURCE: "Resource"
};

export interface IAnnotated {

    annotations(): IAnnotation[]

    annotation(name: string): any

    scalarsAnnotations():{[key:string]:IAnnotation[][]}
}

export interface SecuritySchemeDefinition extends IAnnotated {

    name(): string

    type(): string

    description(): string

    settings(): {[name: string]: any}
}

export type SecuredBy = SecuritySchemeDefinition;


export interface Documentation extends IAnnotated {
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

export interface LibraryBase extends IAnnotated,tsInterfaces.IParsedTypeCollection {

    securitySchemes(): SecuritySchemeDefinition[]

    types(): tsInterfaces.IParsedType[]

    annotationTypes(): tsInterfaces.IParsedType[]
}


export interface Library extends LibraryBase {

    usage(): string
}

export interface ResourceBase extends IAnnotated {

    displayName():string

    description():string

    securedBy(): SecuredBy[]

    methods(): Method[]

    owningApi(): Api

    uriParameters(): Parameter[];

    allUriParameters(): Parameter[];
}

export interface Resource extends ResourceBase {

    relativeUrl();

    fullRelativeUrl();

    absoluteUrl();

    parentResource(): Resource

    resources(): Resource[]
}

export interface MethodBase extends IAnnotated {

    securedBy(): SecuredBy[]

    displayName(): string //

    description(): string //

    parameters(): Parameter[]; //

    bodies(): Body[]; //

    responses(): Response[] //

    protocols():string[]
}

export interface Method extends MethodBase {

    method(): string //

    resource(): Resource //
}

export interface Response extends IAnnotated {

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
}

export interface Body extends IAnnotated {

    mimeType(): string //

    type(): tsInterfaces.IParsedType //
}

