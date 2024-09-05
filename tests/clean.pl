#!/usr/bin/env perl -w

use strict;
use Cwd;
use warnings;
use HTTP::Tiny;

my $fileExist = -e "./.git";
my $T = -e "./tests";

if ( $fileExist ) {
	system("git clean -dxf");
	system("git checkout .");
} else {
	if ( $T ) {
		unlink "tests/yarn.lock";
		unlink "kernelsu/ksupatch.sh";
		unlink"tests/shfmt*";
		rmdir "tests/node_modules";
		chdir("kernelsu/");
		my $url = 'https://github.com/dabao1955/kernel_build_action/raw/main/kernelsu/patch.sh';
		my $httpVariable = HTTP::Tiny->new;
		my $response = $httpVariable->get($url);
		if ($response -> {success}) {
			print "$response->{status}.$response->{reasons}";
		} else {
			print "$response->{status}.$response->{reasons}";
			exit 1;
		}
	}
}
