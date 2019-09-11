/**
 * ProveIt is a reference manager for Wikipedia (and any other MediaWiki wiki)
 * Documentation at https://commons.wikimedia.org/wiki/Help:Gadget-ProveIt
 *
 * Copyright 2008-2011 Georgia Tech Research Corporation, Atlanta, GA 30332-0415, ALL RIGHTS RESERVED
 * Copyright 2011- Matthew Flaschen
 * Rewritten, internationalized, improved and maintained by Sophivorus since 2014
 *
 * ProveIt is available under the GNU Free Documentation License (http://www.gnu.org/copyleft/fdl.html),
 * the Creative Commons Attribution/Share-Alike License 3.0 (http://creativecommons.org/licenses/by-sa/3.0/),
 * and the GNU General Public License 2 (http://www.gnu.org/licenses/gpl-2.0.html)
 */
var ProveIt = {

	/**
	 * Template data of all the citation templates on the current wiki
	 * This property is set on ProveIt.init()
	 *
	 * @type {object} map from template name to template data
	 */
	templateData: {},

	/**
	 * Content language of the current wiki
	 * This property is set on ProveIt.init() and defaults to English
	 *
	 * @type {string} content language code
	 */
	contentLanguage: 'en',

	/**
	 * Convenience method to get a ProveIt configuration option
	 * Configuration options are set in the initialization script of each wiki,
	 * not in this file
	 *
	 * @param {string} option key without the "proveit-" prefix
	 * @return {string} option value
	 */
	getOption: function ( key ) {
		return mw.config.get( 'proveit-' + key );
	},

	/**
	 * Convenience method to get a ProveIt interface message
	 *
	 * @param {string} message key without the "proveit-" prefix
	 * @return {string} message value
	 */
	getMessage: function ( key ) {
		return mw.message( 'proveit-' + key );
	},

	/**
	 * Convenience method to detect the current editor
	 *
	 * @return {string|null} name of the current editor ('basic', 'classic' or '2017')
	 */
	getEditor: function () {
		if ( window.ve && ve.init && ve.init.target && ve.init.target.active && ve.init.target.getSurface().getMode() === 'source' ) {
			return '2017'; // 2017 wikitext editor
		}
		var action = mw.config.get( 'wgAction' );
		if ( action === 'edit' || action === 'submit' ) {
			if ( mw.user.options.get( 'usebetatoolbar' ) === 1 ) {
				return 'classic'; // WikiEditor
			} else {
				return 'basic';
			}
		}
	},

	/**
	 * Convenience method to get the wikitext of the current page
	 *
	 * @return {string} wikitext of the current page
	 */
	getWikitext: function () {
		switch ( ProveIt.getEditor() ) {
			case 'basic':
			case 'classic':
				return $( '#wpTextbox1' ).val();
			case '2017':
				return $( '.ve-ce-documentNode' ).text();
		}
	},

	/**
	 * Initialization script
	 *
	 * @return {void}
	 */
	init: function () {

		// Get and set the content language
		ProveIt.contentLanguage = mw.config.get( 'wgContentLanguage' );

		// Get and set the interface messages from Commons, with English as fallback
		var userLanguage = mw.config.get( 'wgUserLanguage' );
		$.get( '//commons.wikimedia.org/w/api.php', {
			'titles': 'MediaWiki:Gadget-ProveIt-en.json|MediaWiki:Gadget-ProveIt-' + userLanguage + '.json',
			'action': 'query',
			'prop': 'revisions',
			'rvprop': 'content',
			'rvslots': 'main',
			'format': 'json',
			'formatversion': 2,
			'origin': '*', // Allow requests from any origin so that ProveIt can be used on localhost and non-Wikimedia wikis
		}).done( function ( data ) {

			// Extract and set the messages
			var messages, english;
			data.query.pages.forEach( function ( page ) {
				if ( page.title === 'MediaWiki:Gadget-ProveIt-en.json' ) {
					english = JSON.parse( page.revisions[0].slots.main.content );
				} else if ( 'revisions' in page ) {
					messages = JSON.parse( page.revisions[0].slots.main.content );
				}
			});
			messages = Object.assign( english, messages ); // Merge them
			mw.messages.set( messages );

			// Get the template data for the current wiki
			new mw.Api().get({
				'titles': ProveIt.getOption( 'templates' ).join( '|' ),
				'action': 'templatedata',
				'redirects': true,
				'format': 'json',
				'formatversion': 2,
			}).done( function ( data ) {

				// Extract and set the template data
				var templateData, templateName;
				for ( var page in data.pages ) {
					templateData = data.pages[ page ];
					templateName = templateData.title.substring( templateData.title.indexOf( ':' ) + 1 ); // Remove the namespace
					ProveIt.templateData[ templateName ] = templateData;
				}

				// Resolve redirects
				if ( 'redirects' in data ) {
					for ( var redirect in data.redirects ) {
						redirect = data.redirects[ redirect ];
						ProveIt.templateData[ redirect.from ] = ProveIt.templateData[ redirect.to ];
					}
				}

				// Finally, build the GUI
				ProveIt.buildGUI();
			});
		});

		// When previewing, re-add the ProveIt tag (T154357)
		if ( mw.config.get( 'wgAction' ) === 'submit' ) {
			var currentSummary = $( '#wpSummary' ).val(),
				proveitSummary = ProveIt.getOption( 'summary' );
			if ( proveitSummary && currentSummary.indexOf( proveitSummary ) > -1 ) {
				ProveIt.addTag();
			}
		}
	},

	/**
	 * Build the GUI and add it to the DOM
	 *
	 * @return {void}
	 */
	buildGUI: function () {

		// Define the basic elements
		var gui = $( '<div>' ).attr( 'id', 'proveit' ),
			header = $( '<div>' ).attr( 'id', 'proveit-header' ),
			body = $( '<div>' ).attr( 'id', 'proveit-body' ),
			footer = $( '<div>' ).attr( 'id', 'proveit-footer' ),
			logo = $( '<div>' ).attr( 'id', 'proveit-logo' ).html( '<span class="proveit-bracket">[</span><span id="proveit-initial">P</span><span id="proveit-non-initial">roveIt</span><span class="proveit-bracket">]</span>');

		// Put everything together and add it to the DOM
		header.append( logo );
		gui.append( header, body, footer );
		$( 'body' ).append( gui );

		// Make the GUI draggable
		gui.draggable({
			handle: header,
			containment: 'window',
			start: function () {
				gui.css({ 'right': 'auto', 'bottom': 'auto' });
			}
		});

		// Fill the GUI
		ProveIt.buildList();

		// Minimize the GUI
		logo.click( function () {
			$( '#proveit-header button, #proveit-body, #proveit-footer, #proveit-non-initial' ).toggle();
			gui.css({ 'top': 'auto', 'left': 'auto', 'right': 0, 'bottom': 0 }); // Reset the position of the gadget
		}).click();
	},

	/**
	 * Build the reference list and update the GUI with it
	 * 
	 * @return {void}
	 */
	buildList: function () {
		var references = ProveIt.getReferences();

		if ( references.length ) {
			var list = $( '<ol>' ).attr( 'id', 'proveit-reference-list' ),
				item, span, reference;

			// Build a list item for each reference
			for ( var i = 0; i < references.length; i++ ) {
				reference = references[ i ];
				item = $( '<li>' ).addClass( 'proveit-reference-item' );
				item.click( reference, function ( event ) {
					var reference = event.data;
					reference.highlight();
					ProveIt.buildForm( reference );
				});

				// Add the number
				span = $( '<span>' ).addClass( 'proveit-reference-number' ).text( i + 1 );
				item.append( span );

				// Add the citations
				reference.citations.forEach( function ( citation, i ) {
					var link = $( '<a>' ).addClass( 'proveit-citation' ).text( i + 1 );
					link.click( citation, function ( event ) {
						citation = event.data;
						citation.highlight( i );
						event.stopPropagation();
					});
					span.append( link );
				});
				item.append( span );

				// Add the main template of the reference, if any
				if ( reference.getTemplateName() ) {
					span = $( '<span>' ).addClass( 'proveit-reference-template' ).text( reference.getTemplateName() );
					item.append( span );
				}

				// Add the main value of the reference
				item.append( reference.getSnippet() );

				// Add to the list
				list.append( item );
			}

			// Add the list to the GUI and make sure we're at the top
			$( '#proveit-body' ).html( list ).scrollTop( 0 );

		} else {

			var div = $( '<div>' ).attr( 'id', 'proveit-no-references-message' ).text( ProveIt.getMessage( 'no-references' ) );
			$( '#proveit-body' ).html( div );

		}

		// Build the header
		$( '#proveit-header button' ).remove();
		var addButton = $( '<button>' ).addClass( 'progressive' ).text( ProveIt.getMessage( 'add-button' ) );
		$( '#proveit-header' ).prepend( addButton );
		addButton.click( function () {
			// Create a dummy reference and a dummy form out of it
			var templateName = $.cookie( 'proveit-last-template' ), // Remember the user choice
				wikitext = templateName ? '<ref>{{' + templateName + '}}</ref>' : '<ref></ref>',
				reference = new ProveIt.Reference( wikitext );
			ProveIt.buildForm( reference );
		});

		// Build the footer
		$( '#proveit-footer' ).empty();
		if ( references.length ) {
			var filterReferences = $( '<input>' ).attr( 'placeholder', ProveIt.getMessage( 'filter-references' ) );
			filterReferences.keyup( function () {
				var filter = $( this ).val().toLowerCase();
				$( 'li', list ).show().filter( function () {
					return $( this ).text().toLowerCase().indexOf( filter ) === -1;
				}).hide();
			});
			var normalizeButton = $( '<button>' ).attr( 'id', 'proveit-normalize-button' ).text( ProveIt.getMessage( 'normalize-button' ) );
			normalizeButton.click( function () {
				$( this ).remove();
				mw.notify( ProveIt.getMessage( 'normalize-message' ) );
				setTimeout( function () {
					references.forEach( function ( reference ) {
						ProveIt.buildForm( reference ); // There's no current way to avoid going through the interface, but the user doesn't notice
						reference.update();
						ProveIt.buildList();
					});
				}, 100 );
			});
			$( '#proveit-footer' ).prepend( filterReferences, normalizeButton );
		}
	},

	/**
	 * Build the reference form and update the GUI with it
	 * 
	 * @param {object} reference object to fill the form
	 * @return {void}
	 */
	buildForm: function ( reference ) {
		var form = $( '<div>' ).attr( 'id', 'proveit-reference-form' ),
			label, input, div;

		// Add the reference name field
		label = $( '<label>' ).text( ProveIt.getMessage( 'reference-name-label' ) ),
		input = $( '<input>' ).attr( 'id', 'proveit-reference-name' ).val( reference.getName() ),
		div = $( '<div>' ).append( label, input );
		form.append( div );

		// Add the reference group field
		label = $( '<label>' ).text( ProveIt.getMessage( 'reference-group-label' ) ),
		input = $( '<input>' ).attr( 'id', 'proveit-reference-group' ).val( reference.getGroup() ),
		div = $( '<div>' ).append( label, input );
		form.append( div );

		// Add the reference content field
		label = $( '<label>' ).text( ProveIt.getMessage( 'reference-content-label' ) );
		input = $( '<textarea>' ).attr( 'id', 'proveit-reference-content' ).val( reference.getContent() );
		div = $( '<div>' ).append( label, input );
		form.append( div );

		// When the reference content is manually changed, update the parameter fields
		input.keyup( function () {
			var content = $( this ).val(),
				wikitext = '<ref>' + content + '</ref>',
				reference = new ProveIt.Reference( wikitext ),
				templateParams = reference.getTemplateParams();
			$( '.proveit-template-param' ).each( function () {
				var paramName = $( this ).attr( 'name' );
				if ( paramName in templateParams ) {
					$( this ).val( templateParams[ paramName ] );
				}
			});
		});

		// Add the template dropdown menu
		label = $( '<label>' ).text( ProveIt.getMessage( 'reference-template-label' ) );
		input = $( '<select>' ).attr( 'id', 'proveit-reference-template' );
		var templateName = ProveIt.getMessage( 'no-template' ),
			templateOption = $( '<option>' ).text( templateName ).val( '' );
		input.append( templateOption );
		for ( templateName in ProveIt.templateData ) {
			templateOption = $( '<option>' ).text( templateName ).val( templateName );
			if ( reference.getTemplateName() === templateName ) {
				templateOption.attr( 'selected', 'selected' );
			}
			input.append( templateOption );
		}
		div = $( '<div>' ).append( label, input );
		form.append( div );

		// When the template is changed, rebuild the form
		input.change( reference, function ( event ) {
			var reference = event.data;
			if ( reference.exists() ) {
				reference.update();
			} else {
				reference.wikitext = reference.buildWikitext();
			}
			$.cookie( 'proveit-last-template', reference.getTemplateName() ); // Remember the new user choice
			ProveIt.buildForm( reference );
		});

		// Add the parameter fields
		var templateData = reference.getTemplateData(),
			citoidMap = reference.getCitoidMap(),
			paramOrder = reference.getParamOrder(),
			templateParams = reference.getTemplateParams(),
			paramName, paramData, paramLabel, paramPlaceholder, paramDescription, paramAlias, paramValue;

		// If the template has an associated Citoid map, add the Citoid field first
		if ( !$.isEmptyObject( citoidMap ) ) {
			var citoidLabel = ProveIt.getMessage( 'citoid-label' ),
				citoidTooltip = ProveIt.getMessage( 'citoid-tooltip' ),
				citoidPlaceholder = ProveIt.getMessage( 'citoid-placeholder' ),
				citoidButton = $( '<button>' ).text( ProveIt.getMessage( 'citoid-load' ) );
			label = $( '<label>' ).text( citoidLabel ).attr( 'data-tooltip', citoidTooltip );
			input = $( '<input>' ).attr( 'placeholder', citoidPlaceholder );
			div = $( '<div>' ).append( citoidButton, label, input );
			form.append( div );

			// When the Citoid button is clicked, try to extract the reference data automatically via the Citoid service
			citoidButton.click( reference, function ( event ) {
				var URI = $( this ).siblings( 'input' ).val();
				if ( !URI ) {
					return; // Do nothing
				}

				citoidButton.text( ProveIt.getMessage( 'citoid-loading' ) ).attr( 'disabled', true );

				$.get( '//' + ProveIt.contentLanguage + '.wikipedia.org/api/rest_v1/data/citation/mediawiki/' + encodeURIComponent( URI ) ).done( function ( data ) {
					if ( data instanceof Array && data[0] instanceof Object ) {
						var citoidData = data[0],
							reference = event.data,
							templateData = reference.getTemplateData();

						// Recursive helper function
						function setParamPair( paramName, paramValue ) {
							if ( typeof paramName === 'string' && typeof paramValue === 'string' && paramName in templateData.params ) {
								$( '.proveit-template-param[name="' + paramName + '"]' ).val( paramValue );
							} else if ( paramName instanceof Array && paramValue instanceof Array ) {
								for ( var i = 0; i < paramName.length; i++ ) {
									setParamPair( paramName[ i ], paramValue[ i ] );
								}
							}
						}
						for ( var citoidKey in citoidData ) {
							paramName = citoidMap[ citoidKey ];
							paramValue = citoidData[ citoidKey ];
							setParamPair( paramName, paramValue );
						}
						citoidButton.text( ProveIt.getMessage( 'citoid-load' ) ).attr( 'disabled', false );

						var content = reference.buildContent();
						$( '#proveit-reference-content' ).val( content );
					}
				}).error( function () {
					citoidButton.text( ProveIt.getMessage( 'citoid-error' ) );
					setTimeout( function () {
						citoidButton.text( ProveIt.getMessage( 'citoid-load' ) ).attr( 'disabled', false );
					}, 3000 );
				});
			});
		}

		for ( var i = 0; i < paramOrder.length; i++ ) {
			paramName = paramOrder[ i ];

			// Defaults
			paramData = {
				'label': null,
				'description': null,
				'type': null,
				'required': false,
				'suggested': false,
				'deprecated': false,
			};
			paramLabel = paramName;
			paramValue = '';
			paramPlaceholder = '';
			paramDescription = '';

			// Override with template data
			if ( 'params' in templateData && paramName in templateData.params ) {
				paramData = templateData.params[ paramName ];
			}
			if ( paramData.label && ProveIt.contentLanguage in paramData.label ) {
				paramLabel = paramData.label[ ProveIt.contentLanguage ];
			}
			if ( paramData.description && ProveIt.contentLanguage in paramData.description ) {
				paramDescription = paramData.description[ ProveIt.contentLanguage ];
			}

			// Extract the parameter value
			if ( paramName in templateParams ) {
				paramValue = templateParams[ paramName ];
				delete templateParams[ paramName ];
			} else if ( paramData.aliases ) {
				for ( var j = 0; j < paramData.aliases.length; j++ ) {
					paramAlias = paramData.aliases[ j ].trim();
					if ( paramAlias in templateParams ) {
						paramValue = templateParams[ paramAlias ];
						delete templateParams[ paramAlias ];
					}
				}
			}

			// Build the label, input and div
			label = $( '<label>' ).text( paramLabel );
			if ( paramDescription ) {
				label.attr( 'data-tooltip', paramDescription );
			}
			input = paramData.type === 'content' ? $( '<textarea>' ) : $( '<input>' )
			input.val( paramValue ).attr({
				'name': paramName,
				'class': 'proveit-template-param',
				'placeholder': paramPlaceholder
			});
			div = $( '<div>' ).append( label, input );

			// If the parameter is a date, add the Today button
			if ( paramData.type === 'date' ) {
				$( '<button>' ).text( ProveIt.getMessage( 'today-button' ) ).click( input, function ( event ) {
					var input = event.data,
						date = new Date(),
						yyyy = date.getFullYear(),
						mm = ( '0' + ( date.getMonth() + 1 ) ).slice( -2 ),
						dd = ( '0' + date.getDate() ).slice( -2 );
					input.val( yyyy + '-' + mm + '-' + dd );
				}).prependTo( div );
			}

			// Mark the div according to the parameter status
			if ( paramData.required ) {
				div.addClass( 'proveit-required' );
			} else if ( paramData.suggested ) {
				div.addClass( 'proveit-suggested' );
			} else if ( paramData.deprecated ) {
				div.addClass( 'proveit-deprecated' );
			} else {
				div.addClass( 'proveit-optional' );
			}

			// Hide all optional and deprecated parameters, unless they are filled
			if ( !paramValue && ( div.hasClass( 'proveit-optional' ) || div.hasClass( 'proveit-deprecated' ) ) ) {
				div.hide();
			}

			// Add the div to the table
			form.append( div );
		}

		// Build the header
		$( '#proveit-header button' ).remove();
		var backButton = $( '<button>' ).text( ProveIt.getMessage( 'back-button' ) );
		$( '#proveit-header' ).prepend( backButton );
		backButton.click( ProveIt.buildList );

		// Build the footer
		var filterFields = $( '<input>' ).attr( 'placeholder', ProveIt.getMessage( 'filter-fields' ) ),
			insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( ProveIt.getMessage( 'insert-button' ) ).addClass( 'progressive' ),
			updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( ProveIt.getMessage( 'update-button' ) ).addClass( 'progressive' ),
			removeButton = $( '<button>' ).attr( 'id', 'proveit-remove-button' ).text( ProveIt.getMessage( 'remove-button' ) ),
			showAllButton = $( '<button>' ).attr( 'id', 'proveit-show-all-button' ).text( ProveIt.getMessage( 'show-all-button' ) ),
			citeButton = $( '<button>' ).attr( 'id', 'proveit-cite-button' ).text( ProveIt.getMessage( 'cite-button' ) );

		$( '#proveit-footer' ).empty();
		if ( reference.getTemplateName() ) {
			$( '#proveit-footer' ).append( filterFields, showAllButton );
		}
		if ( reference.exists() ) {
			$( '#proveit-footer' ).append( citeButton, removeButton, updateButton );
		} else {
			$( '#proveit-footer' ).append( citeButton, insertButton );
		}

		// Bind events
		insertButton.click( reference, function ( event ) { event.data.insert(); } );
		updateButton.click( reference, function ( event ) { event.data.update(); } );
		removeButton.click( reference, function ( event ) { event.data.remove(); } );
		citeButton.click( reference, function ( event ) { event.data.cite(); } );
		showAllButton.click( function () {
			$( 'div', form ).show();
			$( this ).remove();
		});
		filterFields.keyup( function () {
			var filter = $( this ).val().toLowerCase();
			$( 'div', form ).show().filter( function () {
				return $( this ).text().toLowerCase().indexOf( filter ) === -1;
			}).hide();
		});

		// Add the form to the GUI and make sure we're at the top
		$( '#proveit-body' ).html( form ).scrollTop( 0 );

		// When any template parameter is changed, rebuild the reference content
		var content = reference.getContent();
		$( '.proveit-template-param' ).keyup( function () {
			var wikitext = '<ref>' + content + '</ref>',
				reference = new ProveIt.Reference( wikitext );
			content = reference.buildContent();
			$( '#proveit-reference-content' ).val( content );
		});
	},

	/**
	 * Parse the wikitext of the page in search for references and citations
	 *
	 * @return {array} array of references
	 */
	getReferences: function () {
		var wikitext = ProveIt.getWikitext(),
			citations = [],
			references = [],
			matches;

		// First look for all the citations
		// @todo Move to this.getCitations so that 
		matches = wikitext.match( /<\s*ref[^\/]*\/>/ig );
		if ( matches ) {
			matches.forEach( function ( match ) {
				var citation = new ProveIt.Citation( match );
				citations.push( citation );
			});
		}

		// Then look for all the references
		matches = wikitext.match( /<\s*ref[^>]*>[^<]*<\s*\/\s*ref\s*>/ig );
		if ( matches ) {
			matches.forEach( function ( match ) {
				var reference = new ProveIt.Reference( match );

				// For each reference, check the citations array for citations to it
				citations.forEach( function ( citation ) {
					if ( reference.getName() === citation.getName() ) {
						reference.citations.push( citation );
					}
				});
				references.push( reference );
			});
		}
		return references;
	},

	/**
	 * Add the ProveIt revision tag
	 *
	 * @return {void}
	 */
	addTag: function () {
		var tag = ProveIt.getOption( 'tag' );
		if ( !tag ) {
			return; // No tag defined
		}
		switch ( ProveIt.getEditor() ) {
			case 'basic':
			case 'classic':
				if ( $( '#wpChangeTags' ).length > 0 ) {
					return; // Don't add it twice
				}
				var tagInput = $( '<input>' ).attr({
					'id': 'wpChangeTags',
					'type': 'hidden',
					'name': 'wpChangeTags',
					'value': tag
				});
				$( '#editform' ).prepend( tagInput );
				break;

			case '2017':
				// @todo
				break;
		}
	},

	/**
	 * Add the ProveIt edit summary
	 *
	 * @return {void}
	 */
	addSummary: function () {
		var proveitSummary = ProveIt.getOption( 'summary' );
		if ( !proveitSummary ) {
			return; // No summary defined
		}
		switch ( ProveIt.getEditor() ) {
			case 'basic':
			case 'classic':
				var summaryTextarea = $( '#wpSummary' ),
					summary = summaryTextarea.val();
				if ( summary.indexOf( proveitSummary ) > -1 ) {
					return; // Don't add it twice
				}
				if ( summary ) {
					summary += ( summary.substr( -3 ) === '*/ ' ? '' : '- ' ) + proveitSummary;
				} else {
					summary = proveitSummary;
				}
				summaryTextarea.val( summary );
				break;

			case '2017':
				$( document ).on( 'focus', '.ve-ui-mwSaveDialog-summary textarea', function () {
					var summaryTextarea = $( this ),
						summary = summaryTextarea.val();
					if ( summary.indexOf( proveitSummary ) > -1 ) {
						return; // Don't add it twice
					}
					if ( summary ) {
						summary += ( summary.substr( -3 ) === '*/ ' ? '' : '- ' ) + proveitSummary;
					} else {
						summary = proveitSummary;
					}
					summaryTextarea.val( summary );
				});
				break;
		}
	},

	/**
	 * Helper function to search and replace a string in the 2017 wikitext editor
	 * @copyright Eranroz and Ravid Ziv at https://en.wikipedia.org/wiki/User:%D7%A2%D7%A8%D7%9F/veReplace.js
	 * @license MIT
	 */
	replace: function ( search, replace ) {
		// Recursive helper function to extract the paragraph nodes from the 2017 wikitext editor
		function getParagraphNodes( node ) {
			var nodes = [];
			for ( var i = 0; i < node.children.length; i++ ) {
				if ( node.children[i].type === 'paragraph') {
					nodes.push( node.children[i] );
				}
				if ( node.children[i].children ) {
					nodes.concat( getParagraphNodes( node.children[i] ) );
				}
			}
			return nodes;
		}
		var documentNode = ve.init.target.getSurface().getModel().getDocument().getDocumentNode(),
			paragraphNodes = getParagraphNodes( documentNode ),
			surfaceModel = ve.init.target.getSurface().getModel();
		for ( var i = 0; i < paragraphNodes.length; i++ ) {
			var node = paragraphNodes[i],
				nodeRange = node.getRange(),
				nodeText = surfaceModel.getLinearFragment( nodeRange ).getText(),
				index = nodeText.indexOf( search );
			if ( index === -1 ) {
				continue;
			}
			var start = nodeRange.from + index,
				end = start + search.length,
				rangeToRemove = new ve.Range( start, end ),
				fragment = surfaceModel.getLinearFragment( rangeToRemove );
			fragment.insertContent( replace ); // This also highlights the inserted content
		}
	},

	/**
	 * Citation class
	 *
	 * @class
	 * @param {string} citation wikitext, for example <ref name="foo" />
	 */
	Citation: function ( wikitext ) {

		/**
		 * Citation wikitext
		 */
		this.wikitext = wikitext ? wikitext : '';

		/**
		 * Extract the name from the wikitext
		 * Possible patterns: <ref name="foo">, <ref name = "foo" group = bar >, <ref group=bar name='foo'>
		 *
		 * @return {object} new reference
		 */
		this.getName = function () {
			var name = '',
				match = this.wikitext.match( /<\s*ref([^>]+)>/i );
			if ( match ) {
				var attributes = match[1],
					nameMatch = attributes.match( /name\s*=\s*["']?([^"'>]+)["']?/i );
				if ( nameMatch ) {
					name = nameMatch[1];
				}
			}
			return name;
		};

		/**
		 * Extract the group from the wikitext
		 * Possible patterns: <ref group='bar'>, <ref name = "foo" group = bar >, <ref group=bar name='foo'>
		 *
		 * @return {object} new reference
		 */
		this.getGroup = function () {
			var group = '',
				match = this.wikitext.match( /<\s*ref([^>]+)>/i );
			if ( match ) {
				var attributes = match[1],
					groupMatch = attributes.match( /group\s*=\s*["']?([^"'>]+)["']?/i );
				if ( groupMatch ) {
					group = groupMatch[1];
				}
			}
			return group;
		};

		/**
		 * Build the citation wikitext from the form
		 *
		 * @return {string} citation wikitext
		 */
		this.buildWikitext = function () {
			var name = this.buildName(),
				group = this.buildGroup(),
				wikitext = '<ref';
			if ( name ) {
				wikitext += ' name="' + name + '"';
			}
			if ( group ) {
				wikitext += ' group="' + group + '"';
			}
			wikitext += ' />';
			return wikitext;
		};

		/**
		 * Build the citation name from the form
		 *
		 * @return {string} citation name
		 */
		this.buildName = function () {
			var name = $( '#proveit-reference-name' ).val();
			return name;
		};

		/**
		 * Build the citation group from the form
		 *
		 * @return {string} citation group
		 */
		this.buildGroup = function () {
			var group = $( '#proveit-reference-group' ).val();
			return group;
		};

		/**
		 * Check if this citation is already on the page
		 *
		 * @return {bool}
		 */
		this.exists = function () {
			var wikitext = ProveIt.getWikitext();
			if ( wikitext.indexOf( this.wikitext ) === -1 ) {
				return false;
			}
			return true;
		};

		/**
		 * Insert this citation into the page wikitext
		 *
		 * @return {void}
		 */
		this.insert = function () {
			var wikitext = this.buildWikitext();

			switch ( ProveIt.getEditor() ) {
				case 'basic':
				case 'classic':
					$( '#wpTextbox1' ).textSelection( 'encapsulateSelection', {
						'peri': wikitext,
						'replace': true
					});
					break;

				case '2017':
					ve.init.target.getSurface().getModel().getFragment().collapseToEnd().insertContent( wikitext ).collapseToEnd().select();
					break;
			}
			this.wikitext = wikitext;
			this.highlight();
			if ( this instanceof ProveIt.Reference ) {
				ProveIt.buildForm( this ); // Change the Insert button for Update
			}
			ProveIt.addTag();
			ProveIt.addSummary();
		};

		/**
		 * Update the page wikitext with the latest wikitext of this citation
		 *
		 * @return {void}
		 */
		this.update = function () {
			var wikitext = this.buildWikitext();

			// If this method is being called on a reference, update the citations too
			if ( this instanceof ProveIt.Reference && this.citations.length ) {
				this.citations.forEach( function ( citation ) {
					citation.update();
				});
			}

			switch ( ProveIt.getEditor() ) {
				case 'basic':
				case 'classic':
					var oldWikitext = $( '#wpTextbox1' ).val(),
						newWikitext = oldWikitext.replace( this.wikitext, wikitext );
					$( '#wpTextbox1' ).val( newWikitext );
					break;

				case '2017':
					ProveIt.replace( this.wikitext, wikitext );
					break;
			}
			this.wikitext = wikitext;
			this.highlight();
			if ( this instanceof ProveIt.Reference ) {
				ProveIt.buildForm( this );
			}
			ProveIt.addTag();
			ProveIt.addSummary();
		};

		/**
		 * Remove this citation from the page wikitext
		 *
		 * @return {void}
		 */
		this.remove = function () {

			// If this method is being called on a reference, remove the citations too
			if ( this instanceof ProveIt.Reference && this.citations.length ) {
				if ( !confirm( ProveIt.getMessage( 'confirm-remove' ) ) ) {
					return;
				}
				this.citations.forEach( function ( citation ) {
					citation.remove();
				});
			}

			switch ( ProveIt.getEditor() ) {
				case 'basic':
				case 'classic':
					var oldWikitext = $( '#wpTextbox1' ).val(),
						newWikitext = oldWikitext.replace( this.wikitext, '' );
					$( '#wpTextbox1' ).val( newWikitext );
					break;

				case '2017':
					ProveIt.replace( this.wikitext, '' );
					break;
			}
			ProveIt.addTag();
			ProveIt.addSummary();
			ProveIt.buildList();
		};

		/**
		 * Focus this citation and scroll it into view
		 *
		 * @param {int} occurrence to highlight
		 * @return {void}
		 */
		this.highlight = function ( n ) {
			switch ( ProveIt.getEditor() ) {

				case 'basic':
				case 'classic':
					var textbox = $( '#wpTextbox1' ),
						wikitext = ProveIt.getWikitext(),
						index = wikitext.indexOf( this.wikitext );

					// References may have more than one citation with identical wikitext
					// so here we make sure we're highlighting the one the user intends
					if ( n ) {
						for ( var i = 0; i < n; i++ ) {
							index = wikitext.indexOf( this.wikitext, index + 1 );
						}
					}

					// Highlight the reference
					textbox.textSelection( 'setSelection', {
						'start': index,
						'end': index + this.wikitext.length,
					});
					break;

				case '2017':
					ProveIt.replace( this.wikitext, this.wikitext ); // @todo Find a better way
					break;
			}
		};
	},

	/**
	 * Reference class (extends the citation class)
	 *
	 * @class
	 * @extends ProveIt.Citation
	 * @param {string} reference wikitext
	 */
	Reference: function ( wikitext ) {

		/**
		 * Parent constructor
		 */
		ProveIt.Citation.call( this, wikitext );

		/**
		 * Citations to this reference
		 */
		this.citations = [];

		/**
		 * Insert a citation to this reference
		 *
		 * @return {void}
		 */
		this.cite = function () {
			var citation = new ProveIt.Citation,
				name = this.buildName();
			if ( name ) {
				citation.insert();
			} else {
				name = this.getSnippet();
				name = name.replace( '"', '' );
				if ( name.length > 30 ) {
					name = name.substring( 0, 30 ).trim() + '...';
				}
				$( '#proveit-reference-name' ).val( name );
				citation.insert();
				this.update(); // Update the reference with the new name
				citation.highlight();
			}
		};

		/**
		 * Get the template data for this reference
		 *
		 * @return {object} template data
		 */
		this.getTemplateData = function () {
			var templateData = {},
				templateName = this.getTemplateName();
			if ( templateName in ProveIt.templateData ) {
				templateData = ProveIt.templateData[ templateName ];
			}
			return templateData;
		};

		/**
		 * Get the Citoid map object from the template data
		 *
		 * @return {object} map from Citoid properties to template parameters
		 */
		this.getCitoidMap = function () {
			var citoidMap = {},
				templateData = this.getTemplateData();
			if ( 'maps' in templateData && 'citoid' in templateData.maps ) {
				citoidMap = templateData.maps.citoid;
			}
			return citoidMap;
		};

		/**
		 * Get the parameter order from the template data
		 *
		 * @return {array}
		 */
		this.getParamOrder = function () {
			var paramOrder = [],
				templateData = this.getTemplateData();
			if ( 'paramOrder' in templateData ) {
				paramOrder = templateData.paramOrder;
			} else if ( 'params' in templateData ) {
				paramOrder = Object.keys( templateData.params );
			}
			var templateParams = Object.keys( this.getTemplateParams() );
			paramOrder = paramOrder.concat( templateParams );
			paramOrder = paramOrder.filter( function ( item, index ) {
				return paramOrder.indexOf( item ) === index; // Remove duplicates
			});
			return paramOrder;
		};

		/**
		 * Get the snippet of this reference
		 *
		 * @return {string} snippet of this reference
		 */
		this.getSnippet = function () {
			var templateParams = this.getTemplateParams(),
				templateData = this.getTemplateData();
			for ( var paramName in templateParams ) {
				if ( paramName in templateData.params && templateData.params[ paramName ].required ) {
					return templateParams[ paramName ];
				}
			}
			var content = this.getContent();
			if ( content.length > 100 ) {
				content = content.substring( 0, 100 ).trim() + '...';
			}
			return content;
		};

		/**
		 * Extract the reference content from the reference wikitext
		 *
		 * @return {string} reference content
		 */
		this.getContent = function () {
			var content = '',
				contentMatch = this.wikitext.match( />([\s\S]*)<\s*\/\s*ref\s*>/i );
			if ( contentMatch ) {
				content = contentMatch[1];
			}
			return content;
		};

		/**
		 * Extract the template wikitext from the reference wikitext
		 *
		 * @return {string} template wikitext
		 */
		this.getTemplateWikitext = function () {
			var content = this.getContent(),
				templateWikitext = '',
				templateRegex,
				templateStart,
				templateEnd,
				templateLevel;
			for ( var templateName in ProveIt.templateData ) {
				templateRegex = new RegExp( '{{\\s*' + templateName + '[\\s|}]', 'i' );
				templateStart = content.search( templateRegex );
				if ( templateStart > -1 ) {
					// Figure out the templateEnd by searching for the closing "}}"
					// knowing that there may be subtemplates and other templates before or after the main template
					// Like so: <ref>{{Some template}}{{Cite book |year={{BC|400}} |title=Something}}{{Some other template}}</ref>
					templateEnd = content.length;
					templateLevel = 0;
					for ( var i = templateStart; i < templateEnd; i++ ) {
						if ( content[ i ] + content[ i + 1 ] === '{{' ) {
							templateLevel++;
							i++; // We speed up the loop to avoid multiple matches when two or more templates are found together
						} else if ( content[ i ] + content[ i + 1 ] === '}}' ) {
							templateLevel--;
							i++;
						}
						if ( templateLevel === 0 ) {
							templateEnd = i + 1;
							break;
						}
					}
					templateWikitext = content.substring( templateStart, templateEnd );
					break;
				}
			}
			return templateWikitext;
		};

		/**
		 * Extract the template name from the reference wikitext
		 *
		 * @return {string} template name
		 */
		this.getTemplateName = function () {
			var templateWikitext = this.getTemplateWikitext(),
				templateRegex,
				templateIndex;
			for ( var templateName in ProveIt.templateData ) {
				templateRegex = new RegExp( '{{\\s*' + templateName + '[\\s|}]', 'i' );
				templateIndex = templateWikitext.search( templateRegex );
				if ( templateIndex > -1 ) {
					return templateName;
				}
			}
			return '';
		};

		/**
		 * Extract the template parameters from the reference wikitext
		 * The parameter names here may be aliases or even unregistered in the template data
		 *
		 * A complex template wikitext may be:
		 * {{Cite book
		 * |anonymous parameter
		 * |param1 = value
		 * |param2 = http://example.com?query=string
		 * |param3 = [[Some|link]]
		 * |param4 = {{Subtemplate |anon |param=value}}
		 * }}
		 *
		 * @return {object} template parameters
		 */
		this.getTemplateParams = function () {
			var templateParams = {},
				templateWikitext = this.getTemplateWikitext();

			// Remove the outer braces and split by pipe
			// knowing that we may match pipes inside wikilinks or subtemplates
			var paramArray = templateWikitext.substring( 2, templateWikitext.length - 2 ).split( '|' );

			// Get rid of the template name
			paramArray.shift();

			var paramString, linkLevel = 0, subtemplateLevel = 0, indexOfEqual, paramNumber = 0, paramName, paramValue;
			for ( var i = 0; i < paramArray.length; i++ ) {

				paramString = paramArray[ i ].trim();

				// If we're inside a link or subtemplate, don't disturb it
				if ( linkLevel || subtemplateLevel ) {
					templateParams[ paramName ] += '|' + paramString;
					if ( paramString.indexOf( ']]' ) > -1 ) {
						linkLevel--;
					}
					if ( paramString.indexOf( '}}' ) > -1 ) {
						subtemplateLevel--;
					}
					continue;
				}

				// If we reach this point and there's no equal sign, it's an anonymous parameter
				indexOfEqual = paramString.indexOf( '=' );
				if ( indexOfEqual === -1 ) {
					paramNumber++;
					paramName = paramNumber;
					paramValue = paramString;
					continue;
				}

				paramName = paramString.substring( 0, indexOfEqual ).trim();
				paramValue = paramString.substring( indexOfEqual + 1 ).trim();

				// Check if there's an unclosed link or subtemplate
				if ( paramValue.indexOf( '[[' ) > -1 && paramValue.indexOf( ']]' ) === -1 ) {
					linkLevel++;
				}
				if ( paramValue.indexOf( '{{' ) > -1 && paramValue.indexOf( '}}' ) === -1 ) {
					subtemplateLevel++;
				}

				templateParams[ paramName ] = paramValue;
			}
			return templateParams;
		};

		/**
		 * Build the reference wikitext from the reference form
		 *
		 * @return {string} reference wikitext
		 */
		this.buildWikitext = function () {
			var name = this.buildName(),
				group = this.buildGroup(),
				content = this.buildContent(),
				wikitext = '<ref';
			if ( name ) {
				wikitext += ' name="' + name + '"';
			}
			if ( group ) {
				wikitext += ' group="' + group + '"';
			}
			wikitext += '>' + content + '</ref>';
			return wikitext;
		};

		/**
		 * Build the reference content from the reference form
		 *
		 * @return {string} reference content
		 */
		this.buildContent = function () {
			var content = $( '#proveit-reference-content' ).val(),
				templateWikitext = this.buildTemplateWikitext();
			content = content.replace( this.getTemplateWikitext(), templateWikitext );
			content = content.trim();
			return content;
		};

		/**
		 * Build the template wikitext from the reference form
		 *
		 * @return {string} template wikitext
		 */
		this.buildTemplateWikitext = function () {
			var templateWikitext = '',
				templateName = $( '#proveit-reference-template' ).val();
			if ( templateName ) {
				var templateData = this.getTemplateData(),
					templateFormat = templateData.format,
					paramName,
					paramValue;
				templateWikitext = '{{' + templateName;
				$( '.proveit-template-param' ).each( function () {
					paramName = $( this ).attr( 'name' );
					paramValue = $( this ).val();
					if ( paramName && paramValue ) {
						if ( templateFormat === 'block' ) {
							templateWikitext += '\r\n| ' + paramName + '=' + paramValue;
						} else {
							templateWikitext += ' |' + paramName + '=' + paramValue;
						}
					}
				});
				if ( templateFormat === 'block' ) {
					templateWikitext += '\r\n}}';
				} else {
					templateWikitext += '}}';
				}
			}
			return templateWikitext;
		};
	}
};

mw.loader.using([
	'mediawiki.api',
	'mediawiki.util',
	'jquery.cookie',
	'jquery.textSelection',
	'jquery.ui.draggable'
], ProveIt.init );

/* global mw, ve, $ */