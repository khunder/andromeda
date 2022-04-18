const fn =  function (api) {
  api.cache(true);

  const presets =["@babel/preset-env"];
  const plugins = [
    ["transform-runtime", {
      "regenerator": true
    }]
  ]
  return {
    presets,
    // plugins

  };
}
module.exports=fn;