/**
 * ProveIt is a Wikipedia gadget that makes it easy to find, edit, add and delete references when editing Wikipedia articles.
 * Full documentation at https://commons.wikimedia.org/wiki/Help:Gadget-ProveIt
 *
 * Copyright 2008-2011 Georgia Tech Research Corporation, Atlanta, GA 30332-0415, ALL RIGHTS RESERVED
 * Copyright 2011- Matthew Flaschen
 * Rewritten, internationalized, enhanced and maintained by Felipe Schenone since 2014
 *
 * ProveIt is available under the GNU Free Documentation License (http://www.gnu.org/copyleft/fdl.html),
 * the Creative Commons Attribution/Share-Alike License 3.0 (http://creativecommons.org/licenses/by-sa/3.0/),
 * and the GNU General Public License 2 (http://www.gnu.org/licenses/gpl-2.0.html)
 */

( function ( mw, $ ) {

var proveit = {

	/**
	 * URL of the ProveIt icons hosted at Commons
	 */
	ICON: '//upload.wikimedia.org/wikipedia/commons/thumb/1/19/ProveIt_logo_for_user_boxes.svg/22px-ProveIt_logo_for_user_boxes.svg.png',

	OLDICON: '//upload.wikimedia.org/wikipedia/commons/d/df/ProveitOldIcon.png',

	/**
	 * Template data retrieved from the wiki
	 *
	 * @type {object} mapping template title to templateData
	 */
	templateData: {},

	/**
	 * Content language of the wiki
	 *
	 * @type {string} defaults to English
	 */
	contentLanguage: 'en',

	/**
	 * Convenience method to get a ProveIt option
	 *
	 * @param {string} option key without the "proveit-" prefix
	 * @return {string} option value
	 */
	getOption: function ( key ) {
		return mw.config.get( 'proveit-' + key );
	},

	/**
	 * Convenience method to get a ProveIt message
	 *
	 * @param {string} message key without the "proveit-" prefix
	 * @param {int} number of references
	 * @return {string} message value
	 */
	getMessage: function ( key, param ) {
		return mw.message( 'proveit-' + key, param );
	},

	/**
	 * Convenience method to get the edit textbox
	 *
	 * @return {jQuery} edit textbox
	 */
	getTextbox: function () {
		return $( '#wpTextbox1' );
	},

	/**
	 * Initialization script
	 *
	 * @return {void}
	 */
	init: function () {

		// Set the content language
		proveit.contentLanguage = mw.config.get( 'wgContentLanguage' );

		// Get the interface messages from Commons
		var userLanguage = mw.config.get( 'wgUserLanguage' );
		$.get( '//commons.wikimedia.org/w/api.php', {
			'titles': 'MediaWiki:Gadget-ProveIt-' + userLanguage + '.json|MediaWiki:Gadget-ProveIt-en.json', // Get the English messages as fallback
			'action': 'query',
			'prop': 'revisions',
			'rvprop': 'content',
			'format': 'json',
			'origin': '*' // Allow requests from any origin so that ProveIt can be used on localhost and non-Wikimedia sites
		}).done( function ( data ) {
			//console.log( data );
			var page, enMessages, userLanguageMessages;
			for ( page in data.query.pages ) {
				page = data.query.pages[ page ];
				if ( page.title === 'MediaWiki:Gadget-ProveIt-en.json' ) {
					enMessages = JSON.parse( page.revisions[0]['*'] );
				} else if ( 'revisions' in page ) {
					userLanguageMessages = JSON.parse( page.revisions[0]['*'] );
				}
			}
			if ( userLanguageMessages ) {
				mw.messages.set( userLanguageMessages );
			} else {
				mw.messages.set( enMessages ); // Fallback to English
			}

			// Build the interface
			proveit.build();

			// Get the template data from the wiki
			var templates = proveit.getOption( 'templates' );
			new mw.Api().get({
				'action': 'templatedata',
				'titles': templates ? templates.join( '|' ) : null,
				'format': 'json'
			}).done( function ( data ) {
				//console.log( data );
				for ( var page in data.pages ) {
					page = data.pages[ page ];
					proveit.templateData[ page.title ] = page;
				}
				proveit.parse();
			});
		});

		// Replace the Reference button for the ProveIt button in the new toolbar
		if ( mw.user.options.get( 'usebetatoolbar' ) === 1 ) {
			proveit.getTextbox().wikiEditor( 'removeFromToolbar', {
				'section': 'main',
				'group': 'insert',
				'tool': 'reference'
			});
			proveit.getTextbox().wikiEditor( 'addToToolbar', {
				'section': 'main',
				'group': 'insert',
				'tools': {
					'proveit': {
						'label': 'ProveIt',
						'type': 'button',
						'icon': proveit.ICON,
						'action': {
							'type': 'callback',
							'execute': function () {
								$( '#proveit' ).toggle();
							}
						}
					}
				}
			});
		// Add the ProveIt button in the old toolbar
		} else if ( mw.user.options.get( 'showtoolbar' ) === 1 ) {
			mw.loader.using( 'mediawiki.toolbar', function () {
				$( '<div>' )
				.addClass( 'mw-toolbar-editbutton' )
				.attr( 'title', 'ProveIt' )
				.css( 'background-image', 'url(' + proveit.OLDICON + ')' )
				.appendTo( '#toolbar' ).click( function () {
					$( '#proveit' ).toggle();
				});
			});
		}
	},

	/**
	 * Build the GUI and add it to the DOM
	 *
	 * @return {void}
	 */
	build: function () {

		// Define the basic elements
		var gui = $( '<div>' ).attr( 'id', 'proveit' ),
			header = $( '<div>' ).attr( 'id', 'proveit-header' ),
			logo = $( '<span>' ).attr( 'id', 'proveit-logo' ).text( 'ProveIt' ),
			leftBracket = $( '<span>' ).attr( 'id', 'proveit-left-bracket' ).text( '[' ),
			rightBracket = $( '<span>' ).attr( 'id', 'proveit-right-bracket' ).text( ']' ),
			listTab = $( '<span>' ).attr( 'id', 'proveit-list-tab' ).addClass( 'active' ).text( proveit.getMessage( 'list-tab', 0 ) ),
			addTab = $( '<span>' ).attr( 'id', 'proveit-add-tab' ).text( proveit.getMessage( 'add-tab' ) ),
			content = $( '<div>' ).attr( 'id', 'proveit-content' );

		// Put everything together and add it to the DOM
		logo.prepend( leftBracket ).append( rightBracket );
		header.append( logo, listTab, addTab );
		gui.append( header,	content );
		$( 'body' ).prepend( gui );

		// Make the GUI draggable
		var dragged = false;
		mw.loader.using( 'jquery.ui.draggable' ).then( function () {
			gui.draggable({
				handle: header,
				containment: 'window',
				start: function ( event ) {
					if ( event.toElement.id !== 'proveit-header' ) {
						dragged = true;
					}
					gui.css({
						'right': 'auto',
						'bottom': 'auto'
					});
				}
			});
		});

		// Lastly, bind events
		logo.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			listTab.toggle();
			addTab.toggle();
			content.toggle();
			gui.css({
				'top': 'auto',
				'left': 'auto',
				'right': 0,
				'bottom': 0
			});
		}).click(); // Click the logo to hide the gadget by default

		listTab.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			$( this ).addClass( 'active' ).siblings().removeClass( 'active' );

			proveit.parse();
		});

		addTab.click( function () {
			if ( dragged ) {
				dragged = false; // Reset the flag
				return;
			}
			// Create a dummy reference and a dummy form out of it
			var template = $.cookie( 'proveit-last-template' ), // Remember the user choice
				dummyReference = new proveit.Reference({ 'template': template }),
				dummyForm = dummyReference.toForm();

			content.html( dummyForm );

			// Switch the GUI to add mode
			$( this ).addClass( 'active' ).siblings().removeClass( 'active' );
			$( '#proveit-insert-button' ).show();
			$( '#proveit-cite-button, #proveit-remove-button, #proveit-update-button' ).hide();
		});
	},

	/**
	 * Parse the textbox for references and add them to the GUI
	 *
	 * @return {void}
	 */
	parse: function () {

		// First define the list element
		var referenceList = $( '<ol>' ).attr( 'id', 'proveit-reference-list' );

		// Second, look for all the citations in the wikitext and store them in an array for later
		var wikitext = proveit.getTextbox().val(),
			citations = [],
			citationsRegExp = /<\s*ref\s+name\s*=\s*["|']?\s*([^"'\s]+)\s*["|']?\s*\/\s*>/ig, // Three patterns: <ref name="foo" />, <ref name='foo' /> and <ref name=foo />
			match,
			citation;

		while ( ( match = citationsRegExp.exec( wikitext ) ) ) {
			citation = new proveit.Citation({ 'name': match[1], 'index': match.index, 'string': match[0] });
			citations.push( citation );
		}

		// Third, look for all the references
		var matches = wikitext.match( /<\s*ref[^\/]*>[\s\S]*?<\s*\/\s*ref\s*>/ig ); // We use [\s\S]* instead of .* to match newlines

		if ( matches ) {
			var i, j, reference, referenceItem;
			for ( i = 0; i < matches.length; i++ ) {
				// Turn all the matches into reference objects
				reference = proveit.parseReference( matches[ i ] );

				// For each reference, check the citations array for citations to it
				for ( j = 0; j < citations.length; j++ ) {
					citation = citations[ j ];
					if ( reference.name === citation.name ) {
						reference.citations.push( citation );
					}
				}

				// Finally, turn all the references into list items and insert them into the reference list
				referenceItem = reference.toListItem();

				// Add the reference number
				// We don't use the <ol> numbers because of stying reasons
				referenceItem.prepend( $( '<span>' ).addClass( 'proveit-reference-number' ).text( i + 1 ) );

				// Add the item to the list
				referenceList.append( referenceItem );
			}

			$( '#proveit-list-tab' ).text( proveit.getMessage( 'list-tab', i ) );
			$( '#proveit-content' ).html( referenceList );

		} else {
			$( '#proveit-list-tab' ).text( proveit.getMessage( 'list-tab', 0 ) );
			$( '#proveit-content' ).html( $( '<div>' ).attr( 'id', 'proveit-no-references-message' ).text( proveit.getMessage( 'no-references' ) ) );
		}
	},

	/**
	 * Make a reference object out of a reference string
	 *
	 * @param {string} wikitext of the reference
	 * @return {object} reference object
	 */
	parseReference: function ( referenceString ) {
		// Extract the reference name, if any
		// Three patterns: <ref name="foo">, <ref name='foo'> and <ref name=foo>
		var referenceName = null,
			match = referenceString.match( /<[\s]*ref[\s]*name[\s]*=[\s]*(?:(?:\"(.*?)\")|(?:\'(.*?)\')|(?:(.*?)))[\s]*>/i );
		if ( match ) {
			referenceName = match[1] || match[2] || match[3];
		}

		// Get the index
		var referenceIndex = proveit.getTextbox().val().indexOf( referenceString );

		// Extract the content
		var referenceContent = referenceString.match( />([\s\S]*)<\s*\/\s*ref\s*>/i )[1]; // We use [\s\S]* instead of .* to match newlines

		// Build the basic reference
		var reference = new proveit.Reference({
			'name': referenceName,
			'index': referenceIndex,
			'string': referenceString,
			'content': referenceContent
		});

		// Search for the main template of the reference
		var templateName,
			templateRegex,
			indexStart;
		for ( var templateTitle in proveit.templateData ) {
			templateName = templateTitle.substring( templateTitle.indexOf( ':' ) + 1 ); // Remove the namespace
			templateRegex = new RegExp( '{{\\s*' + templateName + '[\\s|]', 'i' );
			indexStart = referenceContent.search( templateRegex );
			if ( indexStart > -1 ) {
				reference.template = templateName;
				break;
			}
		}

		// The rest of the code is for when a main template was found
		if ( reference.template ) {

			// Figure out the indexEnd by searching for the closing "}}"
			// knowing there may be subtemplates and other templates after the main template
			var indexEnd = referenceContent.length,
				templateLevel = 0;
			for ( i = indexStart; i < indexEnd; i++ ) {
				if ( referenceContent[ i ] + referenceContent[ i + 1 ] === '{{' ) {
					templateLevel++;
					i++; // We speed up the loop to avoid multiple matches when two or more templates are found together
				} else if ( referenceContent[ i ] + referenceContent[ i + 1 ] === '}}' ) {
					templateLevel--;
					i++;
				}
				if ( templateLevel === 0 ) {
					indexEnd = i + 1;
					break;
				}
			}
			reference.templateString = referenceContent.substring( indexStart, indexEnd );

			/**
			 * Parse the parameters inside the main template. A complex example may be:
			 * {{Cite book
			 * |anonymous parameter
			 * |param1 = value1
			 * |param2 = http://example.com?query=string
			 * |param3 = [[Some|link]]
			 * |param4 = {{Subtemplate |anon |param=value}}
			 * }}
			 */

			// Remove the outer braces and split by pipe, knowing that we may match pipes inside links and subtemplates
			var paramArray = reference.templateString.substring( 2, reference.templateString.length - 2 ).split( '|' );
			paramArray.shift(); // Get rid of the template name

			var paramString, linkLevel = 0, subtemplateLevel = 0, indexOfEqual, paramNumber = 0, paramName, paramValue;
			for ( i = 0; i < paramArray.length; i++ ) {

				paramString = paramArray[ i ].trim();

				// If we're inside a link or subtemplate, don't disturb it
				if ( linkLevel || subtemplateLevel ) {
					reference.params[ paramName ] += '|' + paramString;
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

				reference.params[ paramName ] = paramValue;
			}
		}

		return reference;
	},

	/**
	 * Add the ProveIt revision tag
	 *
	 * @return {void}
	 */
	addTag: function () {
		var tag = proveit.getOption( 'tag' );
		if ( !tag ) {
			return; // No tag defined
		}
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
	},

	/**
	 * Add the ProveIt edit summary
	 *
	 * @return {void}
	 */
	addSummary: function () {
		var currentSummary = $( '#wpSummary' ).val(),
			proveitSummary = proveit.getOption( 'summary' );
		if ( !proveitSummary ) {
			return; // No summary defined
		}
		if ( currentSummary.indexOf( proveitSummary ) > -1 ) {
			return; // Don't add it twice
		}
		$( '#wpSummary' ).val( currentSummary ? currentSummary + proveitSummary : proveitSummary );
	},

	/**
	 * Citation class
	 *
	 * @param {object} data for constructing the object
	 */
	Citation: function ( data ) {

		/**
		 * Citation name
		 */
		this.name = data.name ? data.name : '';

		/**
		 * Citation location in the edit textbox
		 */
		this.index = data.index ? data.index : 0;

		/**
		 * Citation wikitext
		 *
		 * Example: <ref name="abc" />
		 */
		this.string = data.string ? data.string : '';

		/**
		 * Convert this citation to wikitext
		 */
		this.toString = function () {
			return '<ref name="' + this.name + '" />';
		};

		/**
		 * Insert this citation into the textbox
		 */
		this.insert = function () {
			var textbox = proveit.getTextbox();
			textbox.textSelection( 'encapsulateSelection', {
				'peri': this.toString(),
				'replace': true
			});
		};

		/**
		 * Highlight the citation in the textbox and scroll it to view
		 *
		 * @return {void}
		 */
		this.highlight = function () {
			var textbox = proveit.getTextbox()[0],
				text = textbox.value;

			// Scroll to the string
			textbox.value = text.substring( 0, this.index );
			textbox.focus();
			textbox.scrollTop = 99999999; // Larger than any real textarea (hopefully)
			var currentScrollTop = textbox.scrollTop;
			textbox.value += text.substring( this.index );
			if ( currentScrollTop > 0 ) {
				textbox.scrollTop = currentScrollTop + 300;
			}

			// Highlight the string
			var start = this.index,
				end = start + this.string.length;
			$( textbox ).focus().textSelection( 'setSelection', { 'start': start, 'end': end } );
		};
	},

	/**
	 * Reference class
	 *
	 * @param {object} Data for constructing the object
	 */
	Reference: function ( data ) {

		/**
		 * Extend the Citation class
		 */
		proveit.Citation.call( this, data );

		/**
		 * Reference content (without the <ref> tags)
		 *
		 * Example: Second chapter of {{Cite book |first=Charles |last=Darwin |title=On the Origin of Species}}
		 */
		this.content = data.content ? data.content : '';

		/**
		 * Array of citations to this reference
		 */
		this.citations = [];

		/**
		 * Name of the main template of this reference, if any
		 *
		 * Example: Cite book
		 */
		this.template = data.template ? data.template : null;

		/**
		 * Wikitext of the main template, if any
		 *
		 * Example: {{Cite book |first=Charles |last=Darwin |title=On the Origin of Species}}
		 */
		this.templateString = data.templateString ? data.templateString : '';

		/**
		 * Object mapping the parameter names of this reference to their values
		 *
		 * This object is constructed directly out of the wikitext, so it doesn't include
		 * any information about the parameters other than their names and values.
		 * Also the parameter names here may be aliases.
		 */
		this.params = {};

		/**
		 * Insert a citation to this reference
		 *
		 * @return {void}
		 */
		this.cite = function ( event ) {
			var reference = event.data;

			// If the reference has no name, ask the user for one
			// @todo check if the name is unique?
			// @todo autogenerate names?
			if ( !reference.name ) {
				reference.name = prompt( proveit.getMessage( 'prompt-name' ) );
				if ( !reference.name ) {
					return;
				}
				var table = reference.toTable();
				$( '#proveit-reference-table' ).replaceWith( table );

				var oldString = reference.string;
				reference.loadFromForm();
				var newString = reference.string;

				// Replace the old reference
				var textbox = proveit.getTextbox(),
					text = textbox.val().replace( oldString, newString );
				textbox.val( text );
			}

			// Add the citation
			var citation = new proveit.Citation({ 'name': reference.name });
			citation.insert();
		};

		/**
		 * Remove this reference and all its citations
		 *
		 * @param {object} click event, with the reference as data
		 * @return {void}
		 */
		this.remove = function ( event ) {
			var reference = event.data;

			// Make sure the user understands that the citations will also be removed
			if ( confirm( proveit.getMessage( 'confirm-remove' ) ) ) {

				// Remove the reference
				var textbox = proveit.getTextbox(),
					text = textbox.val();
				text = text.replace( reference.string, '' );

				// Remove all the citations
				// @todo citation.remove()
				reference.citations.forEach( function ( citation ) {
					text = text.replace( citation.string, '' );
				});

				// Update the textbox
				textbox.val( text );

				// Add the tag and summary
				proveit.addTag();
				proveit.addSummary();

				// Switch to add mode
				$( '#proveit-add-tab' ).addClass( 'active' ).siblings().removeClass( 'active' );
				$( '#proveit-insert-button' ).show();
				$( '#proveit-cite-button, #proveit-remove-button, #proveit-update-button' ).hide();
			}
		};

		/**
		 * Update the wikitext in the textbox with the current data of this reference
		 *
		 * @param {object} click event, with the reference as data
		 * @return {void}
		 */
		this.update = function ( event ) {
			var reference = event.data;

			var oldName = reference.name,
				oldString = reference.string;
			reference.loadFromForm();
			var newName = reference.name,
				newString = reference.string;

			// Replace the old reference
			var textbox = proveit.getTextbox(),
				text = textbox.val();
			text = text.replace( oldString, newString );

			// If the name changed, update the citations
			// @todo citation.update()
			if ( oldName !== newName && reference.citations ) {
				var oldCitationString, newCitationString;
				reference.citations.forEach( function ( citation ) {
					oldCitationString = citation.toString();
					citation.name = newName;
					newCitationString = citation.toString();
					text = text.replace( oldCitationString, newCitationString );
				});
			}

			// Update the textbox
			textbox.val( text );

			// Update the index and highlight the reference
			text = textbox.val();
			reference.index = text.indexOf( newString );
			reference.highlight();

			// Update the GUI
			$( '#proveit-reference-table' ).replaceWith( reference.toTable() );

			// Add the tag and summary
			proveit.addTag();
			proveit.addSummary();
		};

		/**
		 * Insert this reference into the textbox
		 *
		 * @param {object} click event, with the reference as data
		 * @return {void}
		 */
		this.insert = function ( event ) {
			var reference = event.data;

			reference.loadFromForm();

			// Replace the existing selection (if any)
			var string = reference.string,
				textbox = proveit.getTextbox();

			textbox.textSelection( 'encapsulateSelection', {
				'peri': string,
				'replace': true
			});

			// Update the index
			reference.index = textbox.val().indexOf( reference.string );

			// Switch to edit mode
			$( '#proveit-list-tab' ).addClass( 'active' ).siblings().removeClass( 'active' );
			$( '#proveit-reference-table' ).replaceWith( reference.toTable() );
			$( '#proveit-insert-button' ).hide().siblings().show();

			// Add the tag and summary
			proveit.addTag();
			proveit.addSummary();
		};

		/**
		 * Get the template title, like "Template:Cite book"
		 *
		 * @return {string} full template name
		 */
		this.getTemplateTitle = function () {
			var templateTitle = '';
			if ( this.template ) {
				var formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' ),
					templateNamespace = formattedNamespaces[10];
				templateTitle = templateNamespace + ':' + this.template;
			}
			return templateTitle;
		};

		/**
		 * Get the template data for this reference
		 *
		 * @return {object} Template data
		 */
		this.getTemplateData = function () {
			var templateData = {};
			if ( this.template ) {
				var templateTitle = this.getTemplateTitle();
				templateData = proveit.templateData[ templateTitle ];
			}
			return templateData;
		};

		/**
		 * Get the Map object for ProveIt from the template data
		 *
		 * @return {object} Map object
		 */
		this.getTemplateMap = function () {
			var templateMap = {};
			if ( this.template ) {
				var templateData = this.getTemplateData();
				if ( 'maps' in templateData && 'proveit' in templateData.maps ) {
					templateMap = templateData.maps.proveit;
				}
			}
			return templateMap;
		};

		/**
		 * Get the parameter order from the template data
		 *
		 * @return {array}
		 */
		this.getParamOrder = function () {
			var paramOrder = [];
			if ( this.template ) {
				var templateData = this.getTemplateData();
				paramOrder = templateData.paramOrder;
			}
			return paramOrder;
		};

		/**
		 * Get the value of the main parameter for this reference
		 *
		 * @return {string} value of the main parameter for this reference
		 */
		this.getMainValue = function () {
			var mainValue = this.content;
			if ( this.template ) {
				var templateMap = this.getTemplateMap();
				if ( 'main' in templateMap && templateMap.main in this.params ) {
					mainValue = this.params[ templateMap.main ];
				} else {
					var templateData = this.getTemplateData(),
						paramName;
					for ( var i = 0; i < templateData.paramOrder.length; i++ ) {
						paramName = templateData.paramOrder[ i ];
						if ( paramName in this.params ) {
							mainValue = this.params[ paramName ];
							break;
						}
					}
				}
			}
			return mainValue;
		};

		/**
		 * Convert this reference to wikitext
		 *
		 * @return {string} wikitext for this reference
		 */
		this.toString = function () {
			// Build the opening ref tag
			var string = '<ref';
			if ( this.name ) {
				string += ' name="' + this.name + '"';
			}
			string += '>';

			// Build the template string
			if ( this.template ) {
				var templateString = '{{' + this.template;
				for ( var name in this.params ) {
					templateString += ' |' + name + '=' + this.params[ name ];
				}
				templateString += '}}';
				// Build the content string by replacing the old template string with the new
				// By doing this we keep any content that before or after the template string
				this.content = this.content.replace( this.templateString, templateString );
				this.templateString = templateString;
			}
			// Add the content
			string += this.content;

			// Close and return the reference
			string += '</ref>';
			return string;
		};

		/**
		 * Convert this reference to a list item
		 *
		 * @return {jQuery} list item
		 */
		this.toListItem = function () {
			var item = $( '<li>' ).addClass( 'proveit-reference-item' );

			// Add the main template, if any
			if ( this.template ) {
				var templateSpan = $( '<span>' ).addClass( 'proveit-reference-template' ).text( this.template );
				item.html( templateSpan );
			}

			// Add the main value of the reference
			var mainValue = this.getMainValue();
			item.append( mainValue );

			// Add the citations
			var citations = $( '<span>' ).addClass( 'proveit-citations' );
			for ( var i = 1; i <= this.citations.length; i++ ) {
				citations.append( $( '<a>' ).addClass( 'proveit-citation' ).text( i ) );
			}
			item.append( citations );

			// Bind events
			item.click( this, function ( event ) {
				var reference = event.data,
					form = reference.toForm();
				reference.highlight();
				$( '#proveit-content' ).html( form );
				$( '#proveit-insert-button' ).hide().siblings().show();
			});

			$( '.proveit-citation', item ).click( this, function ( event ) {
				var reference = event.data,
					i = parseInt( $( this ).text(), 10 ) - 1,
					citation = reference.citations[ i ];
				citation.highlight();
				event.stopPropagation();
			});

			return item;
		};

		/**
		 * Convert this reference into a HTML table
		 *
		 * @return {jQuery} table
		 */
		this.toTable = function () {
			var table = $( '<table>' ).attr( 'id', 'proveit-reference-table' );

			// Add the reference name field
			var referenceNameLabel = $( '<label>' ).text( proveit.getMessage( 'reference-name-label' ) ),
				referenceNameInput = $( '<input>' ).attr( 'name', 'reference-name' ).val( this.name ),
				referenceNameLabelColumn = $( '<td>' ).append( referenceNameLabel ),
				referenceNameInputColumn = $( '<td>' ).append( referenceNameInput ),
				referenceNameRow = $( '<tr>' ).append( referenceNameLabelColumn, referenceNameInputColumn );
			table.append( referenceNameRow );

			// Add the reference content area
			var referenceContentLabel = $( '<label>' ).text( proveit.getMessage( 'reference-content-label' ) ),
				referenceContentTextarea = $( '<textarea>' ).attr( 'name', 'reference-content' ).val( this.content ),
				referenceContentLabelColumn = $( '<td>' ).append( referenceContentLabel ),
				referenceContentTextareaColumn = $( '<td>' ).append( referenceContentTextarea ),
				referenceContentRow = $( '<tr>' ).append( referenceContentLabelColumn, referenceContentTextareaColumn );
			table.append( referenceContentRow );

			// Add the template dropdown menu
			var templateLabel = $( '<label>' ).text( proveit.getMessage( 'reference-template-label' ) ),
				templateSelect = $( '<select>' ).attr( 'name', 'reference-template' ),
				templateName = proveit.getMessage( 'no-template' ),
				templateOption = $( '<option>' ).text( templateName ).val( '' );
			templateSelect.append( templateOption );
			for ( var templateTitle in proveit.templateData ) {
				templateName = templateTitle.substr( templateTitle.indexOf( ':' ) + 1 ); // Remove the namespace
				templateOption = $( '<option>' ).text( templateName ).val( templateName );
				if ( this.template === templateName ) {
					templateOption.attr( 'selected', 'selected' );
				}
				templateSelect.append( templateOption );
			}
			var templateLabelColumn = $( '<td>' ).append( templateLabel ),
				templateSelectColumn = $( '<td>' ).append( templateSelect ),
				templateRow = $( '<tr>' ).append( templateLabelColumn, templateSelectColumn );
			table.append( templateRow );

			// Add the parameter fields
			var templateData = this.getTemplateData(),
				templateMap = this.getTemplateMap(),
				paramOrder = this.getParamOrder(),
				paramName, paramData, paramLabel, paramPlaceholder, paramDescription, paramAlias, paramValue, row, label, paramNameInput, paramValueInput;

			for ( var i = 0; i < paramOrder.length; i++ ) {
				paramName = paramOrder[ i ];
				paramData = templateData.params[ paramName ];

				// Defaults
				paramLabel = paramName;
				paramPlaceholder = '';
				paramDescription = '';
				paramValue = '';

				// Override with template data
				if ( paramData.label ) {
					paramLabel = paramData.label[ proveit.contentLanguage ];
				}

				// If the parameter is a date, put the current date as a placeholder
				// @todo find a better solution
				if ( paramData.type === 'date' ) {
					var date = new Date(),
						yyyy = date.getFullYear(),
						mm = ( '0' + ( date.getMonth() + 1 ) ).slice( -2 ),
						dd = ( '0' + date.getDate() ).slice( -2 );
					paramPlaceholder = yyyy + '-' + mm + '-' + dd;
				}

				if ( paramData.description ) {
					paramDescription = paramData.description[ proveit.contentLanguage ];
				}

				// Extract the parameter value
				if ( paramName in this.params ) {
					paramValue = this.params[ paramName ];
				} else {
					for ( var j = 0; j < paramData.aliases.length; j++ ) {
						paramAlias = paramData.aliases[ j ].trim();
						if ( paramAlias in this.params ) {
							paramValue = this.params[ paramAlias ];
						}
					}
				}

				// Build the table row
				row = $( '<tr>' ).addClass( 'proveit-param-pair' );
				labelColumn = $( '<td>' );
 				inputColumn = $( '<td>' );
				label = $( '<label>' ).attr( 'title', paramDescription ).text( paramLabel );
				paramNameInput = $( '<input>' ).attr( 'type', 'hidden' ).addClass( 'proveit-param-name' ).val( paramName );
				paramValueInput = $( '<input>' ).attr( 'placeholder', paramPlaceholder ).addClass( 'proveit-param-value' ).val( paramValue );

				// Check if the parameter should be shown as a textarea
				if ( 'textarea' in templateMap && ( templateMap.textarea === paramName || templateMap.textarea.indexOf( paramName ) > -1 ) ) {
					paramValueInput = $( '<textarea>' ).attr( 'placeholder', paramPlaceholder ).addClass( 'proveit-param-value' ).val( paramValue );
				}

				// Mark the required parameters
				if ( paramData.required ) {
					row.addClass( 'proveit-required' );
				}

				// Put it all together and add it to the table
				labelColumn.append( label );
				inputColumn.append ( paramValueInput );
				row.append( labelColumn, inputColumn, paramNameInput );
				table.append( row );
			}

			// Bind events
			templateSelect.change( this, function ( event ) {
				var reference = event.data;
				reference.template = $( this ).val();
				$.cookie( 'proveit-last-template', reference.template ); // Remember the user choice
				table.replaceWith( reference.toTable() );
			});

			return table;
		};

		/**
		 * Convert this reference to an HTML form filled with its data
		 *
		 * @return {jQuery} form
		 */
		this.toForm = function () {

			var form = $( '<form>' ).attr( 'id', 'proveit-reference-form' ),
				table = this.toTable();

			// Add the buttons
			var buttons = $( '<div>' ).attr( 'id', 'proveit-buttons' ),
				citeButton = $( '<button>' ).attr( 'id', 'proveit-cite-button' ).text( proveit.getMessage( 'cite-button' ) ),
				removeButton = $( '<button>' ).attr( 'id', 'proveit-remove-button' ).text( proveit.getMessage( 'remove-button' ) ),
				updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( proveit.getMessage( 'update-button' ) ),
				insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( proveit.getMessage( 'insert-button' ) );
			buttons.append( citeButton, removeButton, updateButton, insertButton );
			form.append( table, buttons );

			// Bind events
			form.submit( false );
			citeButton.click( this, this.cite );
			removeButton.click( this, this.remove );
			updateButton.click( this, this.update );
			insertButton.click( this, this.insert );

			return form;
		};

		/**
		 * Update the data of this reference with the content of the reference form
		 *
		 * @return {void}
		 */
		this.loadFromForm = function () {

			this.name = $( '#proveit-reference-form input[name="reference-name"]' ).val();

			this.content = $( '#proveit-reference-form textarea[name="reference-content"]' ).val();

			this.template = $( '#proveit-reference-form select[name="reference-template"]' ).val();

			// Load all the parameter key-value pairs
			var params = {}, name, value;
			$( '.proveit-param-pair' ).each( function () {
				name = $( '.proveit-param-name', this ).val();
				value = $( '.proveit-param-value', this ).val();
				if ( name !== '' && value !== '' ) {
					params[ name ] = value;
				}
			});
			this.params = params;

			this.string = this.toString();
		};
	}
};

$( proveit.init );

}( mw, jQuery ) );
