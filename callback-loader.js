var astQuery = require("ast-query");
var loaderUtils = require("loader-utils");
var escodegen = require("escodegen");

module.exports = function (source) {
	var query = loaderUtils.parseQuery(this.query);
	var configKey = query.config || 'callbackLoader';
	var thisModule = this;

	var functions = this.options[configKey];
	var functionNames = Object.keys(query).filter(function (key) {
		return key !== 'config';
	});
	if (functionNames.length === 0) {
		functionNames = Object.keys(functions);
	}

	//Offset for future replaces
	var indexOffset;

	//Replace substring between *indexFrom* and *indexTo* in *text* with *replaceText*
	function replaceIn(text, indexFrom, indexTo, replaceText) {
		var actualIndexFrom = indexFrom + indexOffset;
		var actualIndexTo = indexTo + indexOffset;
		//Correcting the offset
		indexOffset = indexOffset + replaceText.length - (indexTo - indexFrom);
		return text.substr(0, actualIndexFrom) + replaceText + text.substr(actualIndexTo, text.length);
	}

	functionNames.forEach(function (funcName) {
		var ast = astQuery(source);
		var query = ast.callExpression(funcName);

		indexOffset = 0;

		query.nodes.forEach(function (node) {
			var args = node.arguments.map(function (argument) {
				if (argument.type == 'Literal') {
					return argument.value;
				} else if (argument.type == 'ObjectExpression') {
					var value = escodegen.generate(argument, {format: {json: true}});
					var value = value.replace(/([A-z]+):/g, '"$1":');
					var value = JSON.parse(value);
					return value;
				} else {
					var msg = 'Error when parsing arguments of function ' + funcName + '. Only absolute values accepted. Index: ' + argument.range[0];
					console.error(msg);
					throw msg;
				}
			});
			var value = functions[funcName].apply(thisModule, args);
			source = replaceIn(source, node.range[0], node.range[1], value.toString());
			console.log (source);
		});
	});

	return source;
}
