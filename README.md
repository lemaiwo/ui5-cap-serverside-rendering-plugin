# ui5-cap-serverside-rendering-plugin
CAP CDS Plugin that enables UI5 pre-rendering on a CAP server. Views or fragments can be developed/stored in the CAP service using handlebars for bindings. This plugin will enable the defined entities to get the data from an entity and replace the handlebar bindings in the view with the data and return a pre-rendered view or fragment. 

## Installation

```sh
npm install ui5-cap-serverside-rendering-plugin
```

## Usage

Create a folder "views" or "fragments" in the "srv" folder of your CAP project. Move your UI5 view or fragment into this folder and replace the UI5 bindings with handlebars, e.g.:
[https://github.com/lemaiwo/ui5-cap-serverside-rendering-plugin/blob/main/tests/demo-project/srv/views/BooksList.view.xml](https://github.com/lemaiwo/ui5-cap-serverside-rendering-plugin/blob/main/tests/demo-project/srv/views/BooksList.view.xml)
```sh
<List headerText="Books" selectionChange="onSelectedBook" mode="SingleSelectMaster" >
    {{#each Books}}
        <StandardListItem
            type="Active"
            title="{{title}} - {{ID}}"
            description="{{author}}">
            <customData>
                <core:CustomData key="ID" value="{{ID}}" writeToDom="true" />
            </customData>
        </StandardListItem>
    {{/each}}
</List>
```

Enable an entity for this pre-rendering by loading the plugin and add the aspect "ServerSideRendering" to the entity. Next to that, you can also define if you like to use views or fragments. The plugin will use view as the default in case this is not defined:
[https://github.com/lemaiwo/ui5-cap-serverside-rendering-plugin/blob/main/tests/demo-project/db/schema.cds](https://github.com/lemaiwo/ui5-cap-serverside-rendering-plugin/blob/main/tests/demo-project/db/schema.cds)
```sh
using { ServerSideRendering } from 'ui5-cap-serverside-rendering-plugin';

entity Books@(ServerSideRenderingType:'view'):ServerSideRendering {
  key ID : Integer;
  title  : String;
  stock  : Integer;
}
```
### Example

You can find a demo project here: [https://github.com/lemaiwo/ui5-cap-serverside-rendering-demo](https://github.com/lemaiwo/ui5-cap-serverside-rendering-demo)
