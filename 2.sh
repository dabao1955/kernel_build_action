#!/bin/bash
# shellcheck disable=SC2086,SC2148
         if [ $1 = true ]; then
             if [ $4 = true ]; then
                 echo "please disable aosp-clang to use 3rd clang."
                 exit 1
             else
                 echo "::group:: Downloading 3rd clang"
                 git clone $2 -b $3 $HOME/clang
                 if [[ $2 == *'.tar.gz' ]]; then
                     wget -O clang.tar.gz $2
                     mkdir clang
                     tar -C clang/ -zxvf clang.tar.gz
                 elif [[ $2 == *'.zip' ]]; then
                     wget -O clang.zip $2
                     mkdir clang
                     unzip clang.zip -d clang/
                 else
                    git clone $2 clang -b $3
                 fi
             fi
         fi
         echo "::endgroup::"

