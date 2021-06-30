BLOCKCHAIN_URL?=http://blockchain:8545

all:
	@echo "No default rule!  Please read README.md."

contract: ./volumes/for-name-server/

jami-name-server.crt jami-name-server.key:
	@echo "Missing key/certificate.  If not in release, run `make cert` first."

clean:
	git restore ./volumes/for-blockchain-dev/var

cert:
	cd ./volumes/for-proxy/certs && ./gen-cert

ci: contract
	JAMI_NS_BLOCKCHAIN_URL=$(BLOCKCHAIN_URL) docker-compose --profile=CI up --detach --build

debug: contract
	JAMI_NS_BLOCKCHAIN_URL=$(BLOCKCHAIN_URL) docker-compose --profile=debug up --detach --build

deploy: contract
	JAMI_NS_BLOCKHAIN_URL=$(BLOCKCHAIN_URL) docker-compose up --profile=deploy --detach --build

check:
	cd name-server && cargo test --no-fail-fast --release

stop:
	docker-compose down

help:
	@echo "Here are the rules.  In doubt, check README.md!"
	@$(foreach p,$(PHONIES), echo -e "\t- $p";)

PHONIES=cert check ci clean debug release stop

.PHONY: $(PHONIES)
