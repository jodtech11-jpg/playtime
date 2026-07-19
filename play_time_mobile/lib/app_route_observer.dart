import 'package:flutter/material.dart';

/// Shared [RouteObserver] so screens (e.g. Home) can clear state when a pushed route pops.
final RouteObserver<ModalRoute<void>> appRouteObserver =
    RouteObserver<ModalRoute<void>>();
