.PHONY: seed dev_backend dev_frontend dev stg_preprocess stg_test spt stg_backend stg_frontend stg

########### LOCAL ###########
local_preprocess:
	ENV=local python3 preprocessor/process_document.py

local_preprocess_hsbc:
	ENV=local python3 preprocessor/process_hsbc.py

local_backend:
	go run . local

local_frontend:
	cd frontend && npm ci && npm run dev:local

local: local_preprocess local_backend local_frontend

########### DEV ###########
dev_backend:
	go run . dev

dev_frontend:
	cd frontend && npm ci && npm run dev:dev

dev: dev_backend dev_frontend

########### STG ###########
stg_preprocess:
	ENV=stg python3 preprocessor/process_document.py

stg_preprocess_hsbc_sagemaker:
	ENV=stg OCR_MODEL=sagemaker python3 preprocessor/process_hsbc.py

stg_test:
	ENV=stg pytest preprocessor/test.py -v

spt: stg_preprocess stg_test

stg_backend:
	go run . stg

stg_frontend:
	cd frontend && npm run dev:stg

stg: spt stg_backend stg_frontend

########### PRD ###########