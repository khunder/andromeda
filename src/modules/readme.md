### Modules are loaded dynamically 
1. The container module is located under engine module because it has customization (/engine/builder/templates/src/modules)
2. web module is used for both engine and container
3. persistence should always be linked to galaxy module


Workflow --> process instances

process instance == service class

service class has a **context**
the context contains all shared objects, like variables


## sub process 



## Code generation
- using static files (snjk extension, static nunjucks files)
  - the folder of the templates is parsed recursively, if an snjk file is found it will be copied as it is.
- using templates combined with [nunjucks](https://mozilla.github.io/nunjucks/) 
- The last method and for the dynamic content we use the excellent tool [ts-morph](https://ts-morph.com/)
  - The service class is generated with a template, then we inject methods into the class
  - We inject also code inside existing methods.

## variables 
variables are persisted in the database as string values to ease the debug and for better ops experience.
the type is persisted along with the variable name and value.



#