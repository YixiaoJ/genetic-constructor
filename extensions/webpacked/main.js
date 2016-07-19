var manifest = require('json!./package.json');

function render(container, options) {
  container.innerHTML = 'extension rendered this!';

  //console.log(options.boundingBox);

  //throw an error for debugging debugging
  //require('./externalFile.js').doBadThing();

  var subscriber = window.constructor.store.subscribe(function (state, lastAction) {
    var last = [];
    var current = state.focus.blockIds;
    if (current &&
      current.length &&
        (current.length !== last.length ||
        !current.every(function (item, index) {return item !== last[index]}))
    ) {

      var block = state.blocks[current[0]];
      block.getSequence().then(function (sequence) {
        console.log(sequence);
      });

      console.log(current);
      last = current;
    }
  });
}

window.constructor.registerExtension(manifest, render);
