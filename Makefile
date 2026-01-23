.PHONY: all

all: blueprint prepack pack

blueprint:
	yarn run blueprint

prepack: blueprint
	yarn run prepack

xgettext:
	yarn run xgettext

pack: prepack
	yarn run pack
