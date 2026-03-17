.PHONY: preprocess test pt stg_backend stg_frontend

preprocess:
	python3 preprocessor/process_document.py

test:
	pytest preprocessor/test.py -v

pt: preprocess test

stg_backend:
	go run . stg

stg_frontend:
	cd frontend && npm run dev:stg

all: pt stg_backend stg_frontend