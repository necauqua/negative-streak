#!/usr/bin/env bash

id=negative-streak

mkdir $id
cp -r *.{lua,xml} $id
zip -r $id $id
rm -rf $id
