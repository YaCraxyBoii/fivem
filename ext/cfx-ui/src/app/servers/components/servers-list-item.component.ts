import { Component, Input, ViewChild, ChangeDetectionStrategy,
    OnDestroy, OnInit, ElementRef, AfterViewInit, NgZone, Renderer2, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';

import { Server } from '../server';

import { GameService } from '../../game.service'
import { DiscourseService, BoostData } from 'app/discourse.service';

import * as hoverintent from 'hoverintent';
import { ServersService } from '../servers.service';

import parseAPNG, { isNotAPNG } from '@citizenfx/apng-js';

@Component({
    moduleId: module.id,
    selector: 'servers-list-item',
    templateUrl: 'servers-list-item.component.html',
    styleUrls: ['servers-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class ServersListItemComponent implements OnInit, OnDestroy, AfterViewInit {
    @Input()
    server: Server;

    @Input()
    pinned = false;

    @ViewChild('iconFigure')
    iconFigure: ElementRef;

    private hoverIntent: any;

    private upvoting = false;

    constructor(private gameService: GameService, private discourseService: DiscourseService,
        private serversService: ServersService, private router: Router, private elementRef: ElementRef,
        private zone: NgZone, private renderer: Renderer2) { }

    get premium() {
        if (!this.server.data.vars) {
            return '';
        }

        return this.server.data.vars.premium;
    }

    public ngOnInit() {
        this.hoverIntent = hoverintent(this.elementRef.nativeElement, () => {
            this.serversService.getServer(this.server.address, true);
        }, () => {});

        this.hoverIntent.options({
            interval: 50
        });
    }

    public ngOnDestroy() {
        this.hoverIntent.remove();
    }

    public ngAfterViewInit() {
        if (this.premium !== 'pt') {
            (async () => {
                try {
                    const response = await fetch(this.server.iconUri);

                    if (!response.ok) {
                        throw new Error();
                    }

                    const buffer = await response.arrayBuffer();
                    const png = parseAPNG(buffer);

                    const figureElement = this.iconFigure.nativeElement as HTMLDivElement;

                    if (isNotAPNG(png)) {
                        const imageElement = document.createElement('img');
                        imageElement.src = this.server.iconUri;

                        await imageElement.decode();

                        this.renderer.appendChild(figureElement, imageElement);
                    } else {
                        if (png instanceof Error) {
                            throw png;
                        }

                        const frame = png.frames[0];
                        await frame.createImage();

                        const imageElement = frame.imageElement;
                        await imageElement.decode();

                        this.renderer.appendChild(figureElement, imageElement);
                    }
                } catch (e) {
                    this.server.setDefaultIcon();
                }
            })();
        }
    }

    attemptConnect(event: Event) {
        this.gameService.connectTo(this.server);

        event.stopPropagation();
    }

    showServerDetail() {
        this.zone.run(() => {
            this.router.navigate(['/', 'servers', 'detail', this.server.address]);
        });
    }

    isFavorite() {
        return this.gameService.isMatchingServer('favorites', this.server);
    }

    toggleFavorite(event: Event) {
        if (this.isFavorite()) {
            this.removeFavorite();
        } else {
            this.addFavorite();
        }

        event.stopPropagation();
    }

    addFavorite() {
        this.gameService.toggleListEntry('favorites', this.server, true);
    }

    removeFavorite() {
        this.gameService.toggleListEntry('favorites', this.server, false);
    }

    enableBoost(event: Event) {
        this.addBoost();

        event.stopPropagation();
    }

    isBoost() {
        return this.discourseService.currentBoost && this.discourseService.currentBoost.address === this.server.address;
    }

    addBoost() {
        if (!this.discourseService.currentUser) {
            this.gameService.invokeInformational(
                'You need to have a linked FiveM account in order to BOOST™ a server.'
            );

            return;
        }

        if (this.upvoting) {
            return;
        }

        this.discourseService.externalCall('https://servers-frontend.fivem.net/api/upvote/', 'POST', {
            address: this.server.address
        }).then((response) => {
            if (response.data.success) {
                if (!this.discourseService.currentBoost) {
                    this.discourseService.currentBoost = new BoostData();
                }

                this.discourseService.currentBoost.address = this.server.address;
                this.discourseService.currentBoost.server = this.server;

                this.gameService.invokeInformational(
                    `Your BOOST™ is now assigned to this server (with an admirable strength of ${response.data.power})! `
                    + 'Thanks for helping the server go higher.'
                );
            } else if (response.data.error) {
                this.gameService.invokeError(
                    response.data.error
                );
            } else {
                this.gameService.invokeError(
                    ':( Assigning BOOST™ failed. Please try again later, or contact FiveM support if this issue persists!'
                );
            }

            this.upvoting = false;
        });
    }
}
