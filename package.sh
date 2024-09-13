#!/usr/bin/env bash

id=negative-streak

mkdir $id
cp -r *.* $id
zip -r $id $id
rm -rf $id
