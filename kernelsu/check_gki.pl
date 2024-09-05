#!/usr/bin/env perl -w

use strict;
use warnings;

open(my $fh, '<', 'Makefile') or die "Can not open Makefile: $!";
my $content = do { local $/; <$fh> };
close($fh);

my ($level) = $content =~ /VERSION\s*=\s*(\d+)/;
my ($sublevel) = $content =~ /PATCHLEVEL\s*=\s*(\d+)/;
my $txt = 'nongki.txt';

die "Can not find PATCHLEVEL in Makefile." unless defined $sublevel;

print "Kernel version: $level.$sublevel\n";

my $gkilevel = 10;
my $gkiversion = 5;

if ($level < $gkiversion) {
	open(my $txt, '>', $txt) or die "Could not open file: $!";
	close($txt);
} else {
	if ($sublevel < $gkilevel) {
		open(my $txt, '>', $txt) or die "Could not open file: $!";
		close($txt);
	}
}

