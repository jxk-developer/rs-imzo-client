**Under development**

# RsImzoClient

**RsImzoClient** allows the integration of electronic key and certificate management system functionality into web applications. It provides secure integration through an `iframe` for working with keys and certificates stored in the browser of the user.

## Key Features

- **Secure Integration:** Integration through an `iframe` ensures safe interaction between the website and the key management system without the need for direct access to the user's private and confidential data.

- **Ease of Use for Developers:** Enables web developers to easily implement complex key and certificate management functions.

- **Enhanced Security and Convenience:** Enhances the level of security and convenience for the users of their services.

## Implementation

To integrate RsImzoClient into your web application, follow the documentation provided with the plugin. Ensure that you have configured the iframe securely and tested the interaction with the key and certificate management system thoroughly.

## Getting Started

Integrating RsImzoClient into your web application is straightforward. You can install the plugin via npm or include it directly from a CDN. Below are the steps for both methods:

### Installation via npm

To install RsImzoClient using npm, run the following command in your project's root directory:

```bash
npm install @jx_code/rsimzo-client
pnpm add @jx_code/rsimzo-client
yarn add @jx_code/rsimzo-client
```

This command adds RsImzoClient to your project dependencies and enables you to import and use it in your web application.
<!-- 
### Including via CDN

If you prefer not to use npm, you can include RsImzoClient directly in your HTML file from a CDN. Add the following script tag to the end of `body` section of your HTML:

```html
<script src="https://cdn.example.com/rsimzoclient/latest/rsimzoclient.min.js"></script>
``` -->

## Basic usage

Get list of certificates

```js
import { RsimzoClient } from "@jx/rsimzo-client";

const rsimzo = new RsimzoClient()

const { data: list } = await rsimzo.getCertificates()

if (list) {
  console.log(list)
}
```

Sign content

```js
const content = 'string you want to sign'
const serial = 'get serial number from rsimzo.getCertificates() method'

const { data: pkcs7 } = await rsimzo.sign(serial, btoa(content))

console.log(pkcs7)
```

## Documentation

We strongly encourage you to explore the [Full documentation](#) for RsImzoClient. It's an invaluable asset for deepening your understanding of the library. The documentation provides comprehensive coverage, from introductory concepts to advanced features, ensuring you have all the information needed to effectively integrate and utilize RsImzoClient in your web applications.
