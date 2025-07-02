namespace my.bookshop;

using {ServerSideRendering} from 'ui5-cap-serverside-rendering-plugin';

entity Books @(
  ServerSideRenderingType: 'view',
  ServerSideRenderingName: 'DemoList',
  VueTemplate: 'vuejs/template.html', // relative to "app" folder
  VueApp: 'vuejs/app.js' // relative to "app" folder
) : ServerSideRendering {
  key ID          : Integer;
      title       : String;
      stock       : Integer;
      to_author   : Association to Authors;
      description : String;
}

entity Authors {
  key ID   : Integer;
      name : String;
}
