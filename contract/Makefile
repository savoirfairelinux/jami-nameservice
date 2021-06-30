SOLC?=solc
CONTRACTS:=council.sol logic.sol store.sol

all: $(CONTRACTS:%.sol=%.out.json)

%.out.json: %.sol
	SOLC=$(SOLC) ./compile $^ $@

clean:
	rm *.out.json

.PHONY: all clean
