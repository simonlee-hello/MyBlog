.PHONY: dev build clean

dev:
	hugo server -D --disableFastRender

build:
	HUGO_ENV=production hugo --gc --minify

clean:
	rm -rf public resources .hugo_build.lock
