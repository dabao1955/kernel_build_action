#!/bin/perl -w

$fileExist = -e "./.git";
if ( $fileExist ) {
        system("git clean -dxf");
        system("git checkout .");
} else {
        system("rm -rf out && make -C src clean");
}
