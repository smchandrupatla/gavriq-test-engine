// Definitions and samples the Schema Converter cases feed to the page. Each is small enough to
// read at a glance and exercises one structural feature: optional fields, a nested group, a
// repeating group (which becomes a JSON-encoded flat column) and typed scalars.

export const ORDER_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Order">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="OrderId" type="xs:string"/>
        <xs:element name="Customer" type="xs:string"/>
        <xs:element name="Line" maxOccurs="unbounded">
          <xs:complexType><xs:sequence>
            <xs:element name="Sku" type="xs:string"/>
            <xs:element name="Qty" type="xs:integer"/>
          </xs:sequence></xs:complexType>
        </xs:element>
        <xs:element name="Note" type="xs:string" minOccurs="0"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
`;
export const ORDER_FIELDS = [
  { path: "/OrderId", required: true, type: "string" },
  { path: "/Customer", required: true, type: "string" },
  { path: "/Line", required: true, type: "array" },
  { path: "/Note", required: false, type: "string" },
];

export const CUSTOMER_JSD = JSON.stringify({
  title: "Customer", type: "object", additionalProperties: false,
  properties: {
    Id: { type: "string", minLength: 2, maxLength: 12, description: "Customer identifier" },
    Name: { type: "string", maxLength: 30 },
    Address: { type: "object", additionalProperties: false, properties: { Country: { type: "string", enum: ["AU", "GB"], maxLength: 2 } }, required: ["Country"] },
    Orders: { type: "array", minItems: 1, maxItems: 3, items: { type: "integer", minimum: 1, maximum: 9 } },
    Active: { type: "boolean" },
  },
  required: ["Id", "Orders"],
}, null, 2);
export const CUSTOMER_FIELDS = [
  { path: "/Id", required: true, type: "string" },
  { path: "/Name", required: false, type: "string" },
  { path: "/Address/Country", required: false, type: "string" },
  { path: "/Orders", required: true, type: "array" },
  { path: "/Active", required: false, type: "boolean" },
];

export const CUSTOMER_YAML = `title: Customer
type: object
additionalProperties: false
properties:
  Id:
    type: string
    minLength: 2
    maxLength: 12
    description: Customer identifier
  Name:
    type: string
    maxLength: 30
  Address:
    type: object
    additionalProperties: false
    properties:
      Country:
        type: string
        enum: [AU, GB]
        maxLength: 2
    required: [Country]
  Orders:
    type: array
    minItems: 1
    maxItems: 3
    items:
      type: integer
      minimum: 1
      maximum: 9
  Active:
    type: boolean
required: [Id, Orders]
`;

export const CUSTOMER_XML_SAMPLE = `<Customer code="001"><Name>Alex</Name><Item>x</Item><Item>y</Item></Customer>`;
export const CUSTOMER_JSON_SAMPLE = JSON.stringify({ id: "c1", name: "Alex", tags: ["a", "b"], active: true });

// Mirrors the template the page offers, so a flat-file source is the shape a user downloads.
export const FLAT_TEMPLATE = {
  kind: "sand-bench-flat-schema", version: 1, name: "Customer", mode: "fixed", delimiter: ",", fields: [
    { name: "CustomerId", type: "string", required: true, maxLength: 12, width: 12, description: "Customer identifier", example: "CUST0001" },
    { name: "Name", type: "string", required: true, maxLength: 30, width: 30, description: "Customer name", example: "Alex Smith" },
    { name: "Country", type: "string", required: false, maxLength: 2, width: 2, enum: ["AU", "GB", "US"], example: "AU" },
  ],
};

// A value that holds every delimiter the page offers, so quoting can be checked in CSV output.
export const DELIMITED_JSD = JSON.stringify({
  title: "Notes", type: "object", additionalProperties: false,
  properties: { Text: { type: "string", examples: ['a,b;c|d\te "q"'] }, Code: { type: "string", enum: ["K1"], maxLength: 2 } },
  required: ["Text", "Code"],
}, null, 2);

// XSD choice is a construct the converter rejects rather than silently loosening.
export const CHOICE_XSD = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Pick"><xs:complexType><xs:choice>
<xs:element name="A" type="xs:string"/><xs:element name="B" type="xs:string"/></xs:choice></xs:complexType></xs:element></xs:schema>`;
