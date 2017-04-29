SOLC ?= solc
registrar.out.json: registrar.sol build.json
	$(SOLC) --allow-paths $(realpath .) --standard-json < build.json > registrar.out.json
